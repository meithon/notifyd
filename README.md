# notifyd

ローカル開発環境向けの軽量通知ルーティング基盤。

CLI 実行、AI エージェントの応答完了、hook 実行結果など、ローカルで発生するイベントを一箇所に集約し、SSE 経由で各クライアントに配信する。

## 特徴

- **in-memory event hub** — イベントを受け取り、SSE で全クライアントに即時配信。永続化なしの最小構成
- **クライアント側コマンド実行** — `notify subscribe` がローカルでコマンドを実行。`DISPLAY` や tmux セッションなど送信元のコンテキストを利用可能
- **group + JSON Schema バリデーション** — イベントのメタデータをグループで構造化し、スキーマでバリデート
- **tRPC + Fastify** — 型安全な API。CLI からも HTTP からも利用可能
- **SSE 配信** — `notify subscribe` は SSE でイベントを受信し、ローカルでコマンドを実行
- **フィルタリング** — `--group-filter` で特定グループのイベントのみ受信可能
- **コマンドテンプレート** — `${title}`, `${message}`, `${level}`, `${group}` などの変数でイベント内容をコマンドに埋め込める

## クイックスタート

```bash
# インストール + ビルド + CLI バンドル
just install

# サーバー起動
just serve
```

サーバーが `http://127.0.0.1:7777` で待機する。

## 使い方

### イベント送信

```bash
# シンプルに送る
notify send --title "build completed"

# メッセージ付き
notify send --title "deploy frontend" --message "staging環境にデプロイしました"

# レベル指定
notify send --title "build failed" --level error

# グループ付き（meta がスキーマに対してバリデートされる）
notify send --title "deploy frontend" --group deploy --meta '{"env":"staging","version":"1.2.3"}'

# メタデータをファイルから読み込む
notify send --title "deploy frontend" --group deploy --meta @deploy-meta.json
```

### イベント購読 — ローカルコマンド実行

`notify subscribe` は SSE でイベントを受信し、各イベント到達時にローカルコマンドを実行する。

```bash
# echo するだけ
notify subscribe --command 'echo hi'

# イベント情報を含む
notify subscribe --command 'echo "[${level}] ${title}: ${message}"'

# デスクトップ通知
notify subscribe --command 'notify-send "${title}" "${message}"'

# tmux に表示
notify subscribe --command 'tmux display-message "${title}"'
```

コマンド内で使えるテンプレート変数:

| 変数 | 内容 |
|------|------|
| `${title}` | タイトル |
| `${message}` | メッセージ |
| `${level}` | レベル (`info`, `warn`, `error`) |
| `${group}` | グループ名 |

環境変数 `NOTIFYD_EVENT` に JSON 形式でイベント全体が渡される。

#### グループでフィルタリング

```bash
# deploy グループのイベントだけ受け取る
notify subscribe --command 'notify-send "${title}" "${message}"' --group-filter deploy

# 複数グループを指定
notify subscribe --command 'echo "${group}: ${title}"' --group-filter deploy,ci
```

### グループ — メタデータの構造定義とバリデーション

グループはイベントのメタデータ (`meta`) に JSON Schema を適用し、バリデートする仕組み。

```bash
# グループを登録（JSON Schema で meta の構造を定義）
notify group register --name deploy \
  --schema '{"type":"object","properties":{"env":{"type":"string","enum":["staging","production"]},"version":{"type":"string"}},"required":["env"]}' \
  --description "Deployment events"

# グループを指定してイベント送信（meta がスキーマに対してバリデートされる）
notify send --title "deploy frontend" --group deploy --meta '{"env":"staging","version":"1.2.3"}'
# → OK

# スキーマに合わない meta は拒否される
notify send --title "deploy frontend" --group deploy --meta '{"env":"invalid"}'
# → Error: Validation failed for group "deploy": data/env must be equal to one of the allowed values

# グループ一覧
notify group list

# グループ削除
notify group remove deploy
```

スキーマファイルから読み込むことも可能:

```bash
notify group register --name deploy --schema @deploy-schema.json
```

## イベントデータ

```jsonc
{
  "id": "b034716c-212d-4934-90f7-2bb1f27c7280",  // サーバー生成
  "time": "2026-04-21T09:21:32.770Z",             // サーバー生成
  "title": "deploy frontend",
  "message": "completed successfully",  // 省略可
  "level": "info",                     // info | warn | error (default: info)
  "group": "deploy",                   // 省略可。指定時はスキーマバリデーションが走る
  "process_id": "proc_123",           // 省略可
  "tags": ["ci"],                      // 省略可
  "meta": { "env": "staging" }         // 省略可。group 指定時はスキーマでバリデート
}
```

## アーキテクチャ

```
┌─────────────┐  ┌─────────────┐
│  CLI (send) │  │  HTTP POST  │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────────────┘
                        │
                 ┌──────┴──────┐
                 │   notifyd   │
                 │  (daemon)   │
                 └──────┬──────┘
                        │ SSE broadcast
           ┌────────────┼────────────┐
           │            │            │
    ┌──────┴──────┐ ┌───┴────┐ ┌────┴─────────┐
    │  subscribe  │ │  sub   │ │  subscribe   │
    │  --command  │ │        │ │  --command   │
    │  echo hi   │ │  ...   │ │  notify-send │
    └─────────────┘ └────────┘ └──────────────┘
```

- **notifyd** はイベントの受信・ブロードキャストのみを担う（SSE）
- **notify subscribe** がイベントを受信し、ローカルコンテキストでコマンドを実行
- コマンド実行はクライアント側なので `DISPLAY` / tmux セッションが利用可能
- group でメタデータの構造を定義し、バリデーションを自動適用

## プロジェクト構成

```
notifyd/
├── bin/notify          # バンドル済み CLI (just install で生成)
├── e2e/                # E2E テスト
├── packages/
│   ├── shared/         # Zod schemas, TypeScript types
│   ├── server/         # notifyd daemon (Fastify + tRPC + SSE)
│   └── cli/            # CLI (notify send / subscribe / group)
├── helm-chart/         # Helm chart
├── Dockerfile          # Multi-stage Docker build
├── justfile            # タスクランナー
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### パッケージ

| パッケージ | 内容 |
|-----------|------|
| `@notifyd/shared` | Zod スキーマ・型定義。server と cli で共有 |
| `@notifyd/server` | notifyd デーモン本体。Fastify + tRPC + Ajv + SSE |
| `@notifyd/cli` | `notify` コマンド。tRPC client + SSE client |

## 開発

```bash
just install     # 依存インストール → ビルド → CLI バンドル
just build      # 全パッケージビルド
just bundle     # CLI のみ再バンドル
just typecheck  # 型チェック
just dev        # サーバー起動 (watch モード)
just test       # E2E テスト実行
just serve      # サーバー起動
```

環境変数:

| 変数 | デフォルト | 内容 |
|------|-----------|------|
| `PORT` | `7777` | サーバーポート |
| `HOST` | `0.0.0.0` | サーバーバインドアドレス |
| `LOG_LEVEL` | `info` | ログレベル |
| `NOTIFYD_URL` | `http://127.0.0.1:7777` | CLI の接続先 |

## 設計方針

- **永続化しない** — group 情報はメモリ上のみ。再起動でリセットされる
- **配送ハブに徹する** — イベントの受信・ブロードキャストのみ。履歴管理や再送は扱わない
- **コマンド実行はクライアント側** — `notify-send` や `tmux` は送信元のデスクトップコンテキストで動くべきため、daemon はコマンドを実行しない

詳細は [`design/core-concept-v2.md`](./design/core-concept-v2.md) を参照。
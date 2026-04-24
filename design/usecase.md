# notifyd ユースケース

## UC-1: コマンド完了通知

| 項目 | 内容 |
|------|------|
| **誰が** | 開発者 |
| **何を達成するか** | 長時間コマンドの終了をデスクトップ通知で知る |

```bash
# 事前に subscribe しておく
notify subscribe --command 'notify-send "${title}" "${message}"'

# 別ターミナルでコマンド完了時にイベント送信
notify send --title "pnpm test (finished)" --level info
```

---

## UC-2: デプロイイベントの構造化通知

| 項目 | 内容 |
|------|------|
| **誰が** | CI/デプロイ担当者 |
| **何を達成するか** | デプロイの環境・バージョンをバリデートして通知先に配送 |

```bash
# group で meta のスキーマを定義
notify group register --name deploy \
  --schema '{"type":"object","properties":{"env":{"type":"string","enum":["staging","production"]},"version":{"type":"string"}},"required":["env"]}'

# deploy グループだけを受け取る subscriber
notify subscribe --command 'notify-send "${title}" "${message}"' --group-filter deploy

# スキーマに合う meta だけ送信可能
notify send --title "deploy frontend" --group deploy --meta '{"env":"staging","version":"1.2.3"}'
# → OK

notify send --title "deploy frontend" --group deploy --meta '{"env":"invalid"}'
# → Error: Validation failed for group "deploy"
```

---

## UC-3: AIエージェントのタスク完了通知

| 項目 | 内容 |
|------|------|
| **誰が** | AIエージェント (opencode等) |
| **何を達成するか** | バックグラウンドタスクの完了を人間に知らせる |

```bash
# エージェントが完了時に送信
notify send --title "refactor完了" --message "3ファイル変更、テスト通過"
```

エージェントは `notify send` を叩くだけ。デスクトップ通知・ログなど、届け方は subscribe 側で自由に設定できる。

---

## UC-4: 複数通知先への同一イベント配送

| 項目 | 内容 |
|------|------|
| **誰が** | 開発者 |
| **何を達成するか** | 1つのイベントをtmux・デスクトップに同時に届ける |

```bash
# tmux に表示
notify subscribe --command 'tmux display-message "${title}"' --group-filter deploy &

# デスクトップ通知
notify subscribe --command 'notify-send "${title}" "${message}"' --group-filter deploy &
```

1つのイベント送信で、全 subscribe プロセスに配信される。

---

## UC-5: イベントのログ記録

| 項目 | 内容 |
|------|------|
| **誰が** | 開発者 |
| **何を達成するか** | 全イベントをファイルに記録して後から振り返る |

```bash
notify subscribe --command 'echo "$(date -Iseconds) ${title}" >> ~/notifyd.log'
```

group_filter を指定しない subscribe は、全イベントを受け取る。

---

## 本質

notifyd は **ローカルで起きたことを、届けたい先に届けるルーター**。

- **sender** はイベントを投げるだけ
- **subscribe** は受け取り方を決めるだけ
- **notifyd** はその間を繋ぐだけ
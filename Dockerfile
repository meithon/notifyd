# --- Stage 1: Build ---
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/cli/package.json packages/cli/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/cli/ packages/cli/

RUN pnpm build

# --- Stage 2: Production ---
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/server/dist/ packages/server/dist/

ENV NODE_ENV=production
ENV PORT=7777

EXPOSE 7777

CMD ["node", "packages/server/dist/index.js"]
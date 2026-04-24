set dotenv-load

# Install dependencies, build all packages, bundle CLI into bin/notify
install:
    pnpm install
    pnpm build
    pnpm --filter @notifyd/cli bundle
    chmod +x bin/notify

build:
    pnpm build

dev:
    pnpm dev

typecheck:
    pnpm typecheck

# Re-bundle CLI only
bundle:
    pnpm --filter @notifyd/cli bundle
    chmod +x bin/notify

# Run e2e tests
test:
    just bundle
    npx vitest run e2e/e2e.test.ts

# Build Docker image
docker-build tag="notifyd:latest":
    podman build -t {{tag}} .
# Start server

serve:
    pnpm --filter @notifyd/server dev

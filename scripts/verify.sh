#!/usr/bin/env bash
# Runs every check a change must pass before it is merged into main.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run lint
npm run format:check
# The end-to-end suite needs a running stack, so here it is only type-checked; `npm run e2e` runs it.
npx tsc -p e2e/tsconfig.json
npm test
npm run build

echo "All checks passed."

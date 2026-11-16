#!/usr/bin/env bash
# Runs every check a change must pass before it is merged into main.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run lint
npm run format:check
npm test
npm run build

echo "All checks passed."

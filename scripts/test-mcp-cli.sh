#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_URLS=(
  "https://store.google.com/category/phones?hl=en-GB&pli=1"
  "https://www.apple.com/ca/store"
)

if [ "$#" -gt 0 ]; then
  URLS=("$@")
else
  URLS=("${DEFAULT_URLS[@]}")
fi

NODE_BIN="$(command -v node)"
SERVER_ENTRY="$ROOT_DIR/dist/src/index.js"
URLS_JSON="$($NODE_BIN -e 'console.log(JSON.stringify(process.argv.slice(1)))' "${URLS[@]}")"

npm run build >/dev/null

npm exec --yes @modelcontextprotocol/inspector -- --cli --transport stdio \
  "$NODE_BIN" \
  "$SERVER_ENTRY" \
  --method tools/call \
  --tool-name analyze_website_style \
  --tool-arg "urls=$URLS_JSON" \
  --tool-arg maxPagesPerSite=5 \
  --tool-arg synthesisMode=cross-site-commonality \
  --tool-arg outputFormat=json+markdown

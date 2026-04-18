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
OUTPUT_DIR="$ROOT_DIR/.tmp"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_PATH="${STYLE_TRACE_OUTPUT_PATH:-$OUTPUT_DIR/mcp-payload-$TIMESTAMP.json}"
EVIDENCE_MODE="${STYLE_TRACE_EVIDENCE_MODE:-omit}"

npm run build >/dev/null
mkdir -p "$OUTPUT_DIR"

npm exec --yes @modelcontextprotocol/inspector -- --cli --transport stdio \
  "$NODE_BIN" \
  "$SERVER_ENTRY" \
  --method tools/call \
  --tool-name analyze_website_style \
  --tool-arg "urls=$URLS_JSON" \
  --tool-arg evidenceMode="$EVIDENCE_MODE" \
  > "$OUTPUT_PATH"

printf '%s\n' "$OUTPUT_PATH"

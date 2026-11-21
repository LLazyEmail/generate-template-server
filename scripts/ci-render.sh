#!/usr/bin/env bash
# Start the server, render real templates, fail if the HTML is not what we expect.
# Writes files under artifacts/ so CI can upload them.
set -euo pipefail

PORT="${PORT:-8787}"
BASE="http://127.0.0.1:${PORT}"
OUT="artifacts"
mkdir -p "$OUT"

cleanup() {
  if [[ -n "${PID:-}" ]]; then kill "$PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

node src/server.mjs >"$OUT/server.log" 2>&1 &
PID=$!

for i in $(seq 1 30); do
  if curl -sf "$BASE/ready" >/dev/null; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "::error::server exited before ready"
    cat "$OUT/server.log"
    exit 1
  fi
  sleep 1
done
curl -sf "$BASE/ready" | tee "$OUT/ready.json"

render() {
  local id="$1" payload="$2" file="$3" expect="$4"
  curl -sf -X POST "$BASE/render-preview" \
    -H 'content-type: application/json' \
    -d "{\"templateId\":\"${id}\",\"payload\":${payload}}" \
    -o "$OUT/$file"
  if ! grep -q "$expect" "$OUT/$file"; then
    echo "::error file=$OUT/$file::$id did not contain '$expect'"
    cat "$OUT/$file"
    exit 1
  fi
  echo "ok $id -> $OUT/$file"
}

render welcome '{"name":"CI"}' welcome.html 'Welcome, CI'
render invoice '{"id":"INV-CI","amount":99}' invoice.html 'Amount: 99'

curl -sf "$BASE/health" | tee "$OUT/health.json"

{
  echo "### Generated templates"
  echo ""
  echo "- \"welcome.html\" contains \"Welcome, CI\""
  echo "- \"invoice.html\" contains \"Amount: 99\""
  echo ""
  echo "Download the artifacts from this run to open the HTML."
} >> "$GITHUB_STEP_SUMMARY"

echo "generated $(wc -c < "$OUT/welcome.html") bytes welcome.html"

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

NODE_BIN="/Users/zz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
ENV_FILE=".env.local"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PROXY_URL="${INNER_NOTES_PROXY:-http://127.0.0.1:7897}"
MODEL="${OPENROUTER_MODEL:-google/gemini-2.5-flash}"
FALLBACKS="${OPENROUTER_MODEL_FALLBACKS:-google/gemini-2.5-flash}"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node runtime not found: $NODE_BIN" >&2
  exit 1
fi

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  read -rsp "Paste OPENROUTER_API_KEY: " OPENROUTER_API_KEY
  echo
  {
    echo "OPENROUTER_API_KEY=\"$OPENROUTER_API_KEY\""
    echo "OPENROUTER_MODEL=\"$MODEL\""
    echo "OPENROUTER_MODEL_FALLBACKS=\"$FALLBACKS\""
    echo "INNER_NOTES_PROXY=\"$PROXY_URL\""
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

if [[ "$OPENROUTER_API_KEY" == *"你的"* || "$OPENROUTER_API_KEY" == *"新key"* || "$OPENROUTER_API_KEY" == *"your"* ]]; then
  echo "OPENROUTER_API_KEY still looks like placeholder text. Paste the real sk-or-... key." >&2
  exit 1
fi

if [[ "$OPENROUTER_API_KEY" != sk-or-* ]]; then
  echo "OPENROUTER_API_KEY should start with sk-or-." >&2
  exit 1
fi

export HTTPS_PROXY="$PROXY_URL"
export HTTP_PROXY="$PROXY_URL"
export OPENROUTER_API_KEY
export OPENROUTER_MODEL="$MODEL"
export OPENROUTER_MODEL_FALLBACKS="$FALLBACKS"

exec "$NODE_BIN" --use-env-proxy server.mjs

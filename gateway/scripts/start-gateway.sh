#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SCRIPT_PATH" ]]; do
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
  SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
  [[ "$SCRIPT_PATH" == /* ]] || SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_PATH"
done

PROJECT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"
ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

"$PROJECT_DIR/gateway/scripts/install-symlinks.sh"
"$PROJECT_DIR/gateway/scripts/apply-gateway.sh"

# shellcheck disable=SC1090
source "$ENV_FILE"

export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${GATEWAY_LAN_IP}:8000}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://${GATEWAY_LAN_IP}:8000/ws}"

docker compose \
  -f "$PROJECT_DIR/docker-compose.gateway.yml" \
  up -d --build

echo "Gateway stack started. Frontend: http://${GATEWAY_LAN_IP}:3000 Backend: http://${GATEWAY_LAN_IP}:8000"

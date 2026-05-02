#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

"$PROJECT_DIR/scripts/gateway/install-symlinks.sh"
"$PROJECT_DIR/scripts/gateway/apply-gateway.sh"

# shellcheck disable=SC1090
source "$ENV_FILE"

export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"

docker compose \
  -f "$PROJECT_DIR/docker-compose.gateway.yml" \
  up -d --build

echo "Gateway stack started. Kibana: http://${GATEWAY_LAN_IP}:5601"

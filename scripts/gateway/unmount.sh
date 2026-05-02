#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
  export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"

  docker compose \
    -f "$PROJECT_DIR/docker-compose.gateway.yml" \
    down || true

  "$PROJECT_DIR/scripts/gateway/cleanup-gateway.sh" || true
fi

sudo rm -f /usr/local/sbin/suricata-gateway-apply
sudo rm -f /usr/local/sbin/suricata-gateway-cleanup
sudo rm -f /usr/local/sbin/suricata-gateway-start
sudo rm -f /usr/local/sbin/suricata-gateway-unmount
sudo rm -f /etc/dnsmasq.d/suricata-lab.conf
sudo rm -f /etc/sysctl.d/99-suricata-gateway.conf

if [[ -n "${PROJECT_LINK_DIR:-}" ]]; then
  sudo rm -f "$PROJECT_LINK_DIR"
else
  sudo rm -f /opt/suricata-lab
fi

if [[ -n "${RENDER_DIR:-}" ]]; then
  sudo rm -rf "$RENDER_DIR"
else
  sudo rm -rf /etc/suricata-lab/rendered
fi

echo "Gateway symlinks, rendered files and rules removed."

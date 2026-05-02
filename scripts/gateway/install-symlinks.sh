#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_DIR="/etc/suricata-lab"
ENV_FILE="$ENV_DIR/gateway.env"

sudo mkdir -p "$ENV_DIR" /etc/dnsmasq.d /etc/sysctl.d /usr/local/sbin /opt

if [[ ! -f "$ENV_FILE" ]]; then
  sudo cp "$PROJECT_DIR/scripts/gateway/gateway.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE"
  echo "Edit WAN_IF and LAN_IF before applying the gateway."
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

PROJECT_LINK_DIR="${PROJECT_LINK_DIR:-/opt/suricata-lab}"

sudo ln -sfn "$PROJECT_DIR" "$PROJECT_LINK_DIR"

if [[ -n "${LAN_IF:-}" && "${LAN_IF:-}" != "__LAN_IF__" ]]; then
  "$PROJECT_DIR/scripts/gateway/render-config.sh"

  sudo ln -sf "${RENDER_DIR:-/etc/suricata-lab/rendered}/dnsmasq-lab.conf" \
    /etc/dnsmasq.d/suricata-lab.conf
else
  echo "Skipping dnsmasq render until LAN_IF is configured in $ENV_FILE"
fi

sudo ln -sf "$PROJECT_DIR/gateway/sysctl-suricata-gateway.conf" \
  /etc/sysctl.d/99-suricata-gateway.conf

sudo ln -sf "$PROJECT_DIR/scripts/gateway/apply-gateway.sh" \
  /usr/local/sbin/suricata-gateway-apply

sudo ln -sf "$PROJECT_DIR/scripts/gateway/cleanup-gateway.sh" \
  /usr/local/sbin/suricata-gateway-cleanup

sudo ln -sf "$PROJECT_DIR/scripts/gateway/start-gateway.sh" \
  /usr/local/sbin/suricata-gateway-start

sudo ln -sf "$PROJECT_DIR/scripts/gateway/unmount.sh" \
  /usr/local/sbin/suricata-gateway-unmount

chmod +x "$PROJECT_DIR"/scripts/gateway/*.sh

echo "Gateway symlinks installed."
echo "Next: edit $ENV_FILE, then run sudo /usr/local/sbin/suricata-gateway-start"

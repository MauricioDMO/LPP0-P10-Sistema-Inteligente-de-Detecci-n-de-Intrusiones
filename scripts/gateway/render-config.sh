#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  echo "Run scripts/gateway/install-symlinks.sh first, then edit WAN_IF and LAN_IF." >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(LAN_IF LAN_IP DHCP_START DHCP_END DHCP_LEASE DNS_1 DNS_2 RENDER_DIR)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" || "${!var}" == "__LAN_IF__" ]]; then
    echo "Invalid or unset variable: $var" >&2
    exit 1
  fi
done

sudo mkdir -p "$RENDER_DIR"

tmp_file="$(mktemp)"
cp "$PROJECT_DIR/gateway/templates/dnsmasq-lab.conf.tpl" "$tmp_file"

replace() {
  local key="$1"
  local value="$2"
  value="${value//\\/\\\\}"
  value="${value//&/\\&}"
  sed -i "s|{{$key}}|$value|g" "$tmp_file"
}

replace LAN_IF "$LAN_IF"
replace LAN_IP "$LAN_IP"
replace DHCP_START "$DHCP_START"
replace DHCP_END "$DHCP_END"
replace DHCP_LEASE "$DHCP_LEASE"
replace DNS_1 "$DNS_1"
replace DNS_2 "$DNS_2"

sudo install -m 0644 "$tmp_file" "$RENDER_DIR/dnsmasq-lab.conf"
rm -f "$tmp_file"

echo "Rendered $RENDER_DIR/dnsmasq-lab.conf"

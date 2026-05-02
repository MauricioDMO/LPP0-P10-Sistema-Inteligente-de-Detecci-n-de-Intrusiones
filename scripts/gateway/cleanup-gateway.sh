#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(WAN_IF LAN_IF LAN_NET NFQUEUE_NUM)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" || "${!var}" == "__WAN_IF__" || "${!var}" == "__LAN_IF__" ]]; then
    echo "Invalid or unset variable: $var" >&2
    exit 1
  fi
done

iptables -t nat -D POSTROUTING -s "$LAN_NET" -o "$WAN_IF" -j MASQUERADE 2>/dev/null || true
iptables -D FORWARD -i "$LAN_IF" -o "$WAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM" 2>/dev/null || true
iptables -D FORWARD -i "$WAN_IF" -o "$LAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM" 2>/dev/null || true

systemctl restart dnsmasq 2>/dev/null || true

echo "Gateway iptables rules cleaned."

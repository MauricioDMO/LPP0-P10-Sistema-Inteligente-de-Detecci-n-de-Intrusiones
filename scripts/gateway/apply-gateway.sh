#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${GATEWAY_ENV_FILE:-/etc/suricata-lab/gateway.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(WAN_IF LAN_IF LAN_IP LAN_CIDR LAN_NET NFQUEUE_NUM)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" || "${!var}" == "__WAN_IF__" || "${!var}" == "__LAN_IF__" ]]; then
    echo "Invalid or unset variable: $var" >&2
    exit 1
  fi
done

echo "[1/7] Bringing interfaces up..."
ip link set "$WAN_IF" up
ip link set "$LAN_IF" up

echo "[2/7] Configuring LAN address..."
ip addr flush dev "$LAN_IF"
ip addr add "$LAN_CIDR" dev "$LAN_IF"

echo "[3/7] Enabling IPv4 forwarding..."
sysctl -w net.ipv4.ip_forward=1

echo "[4/7] Disabling IPv6 for the gateway lab..."
sysctl -w net.ipv6.conf.all.disable_ipv6=1 || true
sysctl -w net.ipv6.conf.default.disable_ipv6=1 || true
sysctl -w "net.ipv6.conf.${LAN_IF}.disable_ipv6=1" || true
sysctl -w "net.ipv6.conf.${WAN_IF}.disable_ipv6=1" || true

echo "[5/7] Removing previous gateway rules..."
iptables -t nat -D POSTROUTING -s "$LAN_NET" -o "$WAN_IF" -j MASQUERADE 2>/dev/null || true
iptables -D FORWARD -i "$LAN_IF" -o "$WAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM" 2>/dev/null || true
iptables -D FORWARD -i "$WAN_IF" -o "$LAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM" 2>/dev/null || true

echo "[6/7] Applying NAT..."
iptables -t nat -A POSTROUTING -s "$LAN_NET" -o "$WAN_IF" -j MASQUERADE

echo "[7/7] Applying FORWARD NFQUEUE fail-closed..."
iptables -I FORWARD 1 -i "$LAN_IF" -o "$WAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM"
iptables -I FORWARD 2 -i "$WAN_IF" -o "$LAN_IF" -j NFQUEUE --queue-num "$NFQUEUE_NUM"

echo "Restarting dnsmasq..."
systemctl restart dnsmasq

echo "Gateway applied: WAN_IF=$WAN_IF LAN_IF=$LAN_IF LAN=$LAN_CIDR NFQUEUE=$NFQUEUE_NUM"

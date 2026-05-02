#!/usr/bin/env bash
set -euo pipefail

MODE="${SURICATA_MODE:-local-ips}"
NFQUEUE_NUM="${SURICATA_NFQUEUE_NUM:-0}"

queue_traffic() {
  local iptables_cmd="$1"
  local chain="$2"
  if "$iptables_cmd" -C "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM" >/dev/null 2>&1; then
    return 0
  fi
  "$iptables_cmd" -I "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM"
}

cleanup_queue_rules() {
  iptables -D OUTPUT -j NFQUEUE --queue-num "$NFQUEUE_NUM" >/dev/null 2>&1 || true
  ip6tables -D OUTPUT -j NFQUEUE --queue-num "$NFQUEUE_NUM" >/dev/null 2>&1 || true
}

if [[ "$MODE" == "ips" ]]; then
  MODE="local-ips"
fi

if [[ "$MODE" == "local-ips" ]]; then
  trap cleanup_queue_rules EXIT

  queue_traffic iptables OUTPUT
  queue_traffic ip6tables OUTPUT

  echo "Starting Suricata in local IPS mode on NFQUEUE $NFQUEUE_NUM..."

  exec suricata \
    -c /etc/suricata/suricata.yaml \
    -q "$NFQUEUE_NUM" \
    -l /var/log/suricata
fi

if [[ "$MODE" == "gateway-ips" ]]; then
  echo "Starting Suricata in gateway IPS mode on NFQUEUE $NFQUEUE_NUM..."

  exec suricata \
    -c /etc/suricata/suricata.yaml \
    -q "$NFQUEUE_NUM" \
    -l /var/log/suricata
fi

if [[ "$MODE" != "ids" ]]; then
  echo "Error: SURICATA_MODE must be 'local-ips', 'gateway-ips', 'ids' or legacy 'ips'." >&2
  exit 1
fi

RAW_IFACES="${SURICATA_INTERFACE:-eth0}"
IFS=',' read -r -a IFACES <<< "$RAW_IFACES"

INTERFACE_ARGS=()
for iface in "${IFACES[@]}"; do
  iface="${iface//[[:space:]]/}"
  if [[ -n "$iface" ]]; then
    INTERFACE_ARGS+=( -i "$iface" )
  fi
done

if [[ ${#INTERFACE_ARGS[@]} -eq 0 ]]; then
  echo "Error: SURICATA_INTERFACE is empty or invalid." >&2
  exit 1
fi

echo "Starting Suricata in IDS mode on interfaces: ${INTERFACE_ARGS[*]}"

exec suricata \
  -c /etc/suricata/suricata.yaml \
  "${INTERFACE_ARGS[@]}" \
  -l /var/log/suricata

#!/usr/bin/env bash
set -euo pipefail

MODE="${SURICATA_MODE:-ips}"

queue_traffic() {
  local iptables_cmd="$1"
  local chain="$2"
  if "$iptables_cmd" -C "$chain" -j NFQUEUE --queue-num 0 >/dev/null 2>&1; then
    return 0
  fi
  "$iptables_cmd" -I "$chain" -j NFQUEUE --queue-num 0
}

cleanup_queue_rules() {
  iptables -D OUTPUT -j NFQUEUE --queue-num 0 >/dev/null 2>&1 || true
  ip6tables -D OUTPUT -j NFQUEUE --queue-num 0 >/dev/null 2>&1 || true
}

if [[ "$MODE" == "ips" ]]; then
  trap cleanup_queue_rules EXIT

  queue_traffic iptables OUTPUT
  queue_traffic ip6tables OUTPUT

  exec suricata \
    -c /etc/suricata/suricata.yaml \
    -q 0 \
    -l /var/log/suricata
fi

if [[ "$MODE" != "ids" ]]; then
  echo "Error: SURICATA_MODE must be 'ips' or 'ids'." >&2
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

exec suricata \
  -c /etc/suricata/suricata.yaml \
  "${INTERFACE_ARGS[@]}" \
  -l /var/log/suricata

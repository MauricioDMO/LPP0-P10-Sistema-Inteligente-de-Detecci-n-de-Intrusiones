#!/usr/bin/env bash
set -euo pipefail

MODE="${SURICATA_MODE:-ips}"
NFQUEUE_NUM="${SURICATA_NFQUEUE_NUM:-0}"

prepare_rules() {
  mkdir -p /var/lib/suricata/rules
  touch /var/lib/suricata/rules/suricata.rules
}

queue_traffic() {
  local iptables_cmd="$1"
  local chain="$2"
  if "$iptables_cmd" -C "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM" --queue-bypass >/dev/null 2>&1; then
    return 0
  fi
  "$iptables_cmd" -I "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM" --queue-bypass
}

cleanup_queue_rules() {
  for iptables_cmd in iptables ip6tables; do
    for chain in OUTPUT FORWARD; do
      while "$iptables_cmd" -D "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM" --queue-bypass >/dev/null 2>&1; do :; done
      while "$iptables_cmd" -D "$chain" -j NFQUEUE --queue-num "$NFQUEUE_NUM" >/dev/null 2>&1; do :; done
    done
  done
}

stop_suricata() {
  if [[ -n "${SURICATA_PID:-}" ]] && kill -0 "$SURICATA_PID" >/dev/null 2>&1; then
    kill -TERM "$SURICATA_PID" >/dev/null 2>&1 || true
    wait "$SURICATA_PID" >/dev/null 2>&1 || true
  fi

  cleanup_queue_rules
}

if [[ "$MODE" == "local-ips" ]]; then
  MODE="ips"
fi

if [[ "$MODE" == "ips" ]]; then
  trap stop_suricata EXIT INT TERM

  prepare_rules
  cleanup_queue_rules

  queue_traffic iptables OUTPUT
  queue_traffic iptables FORWARD
  queue_traffic ip6tables OUTPUT
  queue_traffic ip6tables FORWARD

  suricata \
    -c /etc/suricata/suricata.yaml \
    -q "$NFQUEUE_NUM" \
    -l /var/log/suricata &
  SURICATA_PID="$!"
  set +e
  wait "$SURICATA_PID"
  status="$?"
  set -e
  exit "$status"
fi

if [[ "$MODE" == "gateway-ips" ]]; then
  exec suricata \
    -c /etc/suricata/suricata.yaml \
    -q "$NFQUEUE_NUM" \
    -l /var/log/suricata
fi

if [[ "$MODE" != "ids" ]]; then
  echo "Error: SURICATA_MODE must be 'ips', 'local-ips', 'gateway-ips' or 'ids'." >&2
  exit 1
fi

prepare_rules

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

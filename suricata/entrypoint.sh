#!/usr/bin/env bash
set -euo pipefail

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

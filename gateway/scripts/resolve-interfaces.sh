#!/usr/bin/env bash

normalize_mac() {
  local mac="$1"
  printf '%s' "$mac" | tr '[:upper:]' '[:lower:]'
}

iface_by_mac() {
  local wanted_mac
  wanted_mac="$(normalize_mac "$1")"

  local iface_path iface iface_mac
  for iface_path in /sys/class/net/*; do
    [[ -e "$iface_path/address" ]] || continue
    iface="${iface_path##*/}"
    iface_mac="$(normalize_mac "$(<"$iface_path/address")")"

    if [[ "$iface_mac" == "$wanted_mac" ]]; then
      printf '%s\n' "$iface"
      return 0
    fi
  done

  return 1
}

is_unset_iface() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == "__WAN_IF__" || "$value" == "__LAN_IF__" ]]
}

resolve_gateway_interfaces() {
  resolve_lan_interface
  resolve_wan_interface

  if [[ "$LAN_IF" == "$WAN_IF" ]]; then
    echo "LAN_IF and WAN_IF resolved to the same interface: $LAN_IF" >&2
    return 1
  fi

  export LAN_IF WAN_IF
}

resolve_lan_interface() {
  if is_unset_iface "${LAN_IF:-}"; then
    if [[ -z "${INTERNAL_MAC:-}" || "${INTERNAL_MAC:-}" == "__INTERNAL_MAC__" ]]; then
      echo "Invalid or unset variable: LAN_IF or INTERNAL_MAC" >&2
      return 1
    fi

    LAN_IF="$(iface_by_mac "$INTERNAL_MAC")" || {
      echo "No interface found for INTERNAL_MAC=$INTERNAL_MAC" >&2
      return 1
    }
    echo "Resolved LAN_IF=$LAN_IF from INTERNAL_MAC=$INTERNAL_MAC"
  fi

  export LAN_IF
}

resolve_wan_interface() {
  if is_unset_iface "${WAN_IF:-}"; then
    if [[ -z "${EXTERNAL_MAC:-}" || "${EXTERNAL_MAC:-}" == "__EXTERNAL_MAC__" ]]; then
      echo "Invalid or unset variable: WAN_IF or EXTERNAL_MAC" >&2
      return 1
    fi

    WAN_IF="$(iface_by_mac "$EXTERNAL_MAC")" || {
      echo "No interface found for EXTERNAL_MAC=$EXTERNAL_MAC" >&2
      return 1
    }
    echo "Resolved WAN_IF=$WAN_IF from EXTERNAL_MAC=$EXTERNAL_MAC"
  fi

  export WAN_IF
}

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_URL="${API_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/suricata-dev-check-cookies.txt}"

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

DOCKER_VIA_SG=0
if docker info >/dev/null 2>&1; then
  DOCKER_VIA_SG=0
elif command -v sg >/dev/null 2>&1 && sg docker -c 'docker info >/dev/null 2>&1'; then
  DOCKER_VIA_SG=1
else
  fail "Docker no esta accesible."
fi

docker_cmd() {
  if [[ "$DOCKER_VIA_SG" -eq 0 ]]; then
    docker "$@"
    return
  fi

  local command_text="docker"
  local arg
  for arg in "$@"; do
    command_text+=" $(printf '%q' "$arg")"
  done
  sg docker -c "$command_text"
}

compose() {
  docker_cmd compose "$@"
}

login_if_requested() {
  if [[ -z "${CHECK_USERNAME:-}" ]]; then
    read -r -p "Usuario para checks autenticados (Enter para omitir): " CHECK_USERNAME
  fi
  if [[ -z "${CHECK_USERNAME:-}" ]]; then
    return 1
  fi
  if [[ -z "${CHECK_PASSWORD:-}" ]]; then
    read -r -s -p "Password de $CHECK_USERNAME: " CHECK_PASSWORD
    printf '\n'
  fi

  rm -f "$COOKIE_FILE"
  local response_file
  local status
  response_file="$(mktemp)"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
    -X POST "$API_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(CHECK_USERNAME="$CHECK_USERNAME" CHECK_PASSWORD="$CHECK_PASSWORD" python3 - <<'PY'
import json
import os
print(json.dumps({"username": os.environ["CHECK_USERNAME"], "password": os.environ["CHECK_PASSWORD"]}))
PY
)")"
  if [[ "$status" == "200" ]]; then
    rm -f "$response_file"
    return 0
  fi
  printf 'Login omitido/fallido (HTTP %s): %s\n' "$status" "$(tr '\n' ' ' < "$response_file")" >&2
  rm -f "$response_file"
  return 1
}

main() {
  log "Servicios Docker Compose"
  compose ps

  log "Endpoints publicos"
  curl -fsS http://localhost:9200 >/dev/null && printf 'Elasticsearch OK\n'
  curl -fsS "$API_URL/api/events/health" >/dev/null && printf 'Backend health OK\n'
  curl -fsSI "$FRONTEND_URL" >/dev/null && printf 'Frontend OK\n'
  docker_cmd exec redis redis-cli PING >/dev/null && printf 'Redis OK\n'

  log "Suricata IPS"
  docker_cmd exec suricata iptables -L OUTPUT -n | grep NFQUEUE
  local rule_count
  rule_count="$(docker_cmd exec suricata wc -l /var/lib/suricata/rules/suricata.rules | awk '{print $1}')"
  printf 'Reglas Suricata: %s lineas\n' "$rule_count"
  [[ "$rule_count" -gt 0 ]] || fail "Suricata no tiene reglas cargadas; ejecuta scripts/dev-up.sh o aplica el perfil activo."
  docker_cmd logs suricata --tail=40 | grep -E 'rule reload complete|Engine started|rule reload starting' || true

  if login_if_requested; then
    log "Endpoints autenticados"
    curl -fsS -b "$COOKIE_FILE" "$API_URL/api/auth/me" >/dev/null && printf 'Auth /me OK\n'
    curl -fsS -b "$COOKIE_FILE" "$API_URL/api/suricata/status" >/dev/null && printf 'Suricata status OK\n'
    curl -fsS -b "$COOKIE_FILE" "$API_URL/api/events/latest?limit=3" >/dev/null && printf 'Latest events OK\n'
    curl -fsS -b "$COOKIE_FILE" "$API_URL/api/events/stats?hours=24" >/dev/null && printf 'Stats OK\n'
  else
    log "Checks autenticados omitidos."
  fi

  log "Verificacion completada."
}

main "$@"

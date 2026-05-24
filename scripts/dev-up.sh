#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_URL="${API_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/suricata-dev-up-cookies.txt}"
BOOTSTRAP_COOKIE_FILE="${BOOTSTRAP_COOKIE_FILE:-/tmp/suricata-bootstrap-cookies.txt}"

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta comando requerido: $1"
}

require_cmd curl
require_cmd python3

DOCKER_VIA_SG=0
if docker info >/dev/null 2>&1; then
  DOCKER_VIA_SG=0
elif command -v sg >/dev/null 2>&1 && sg docker -c 'docker info >/dev/null 2>&1'; then
  DOCKER_VIA_SG=1
else
  fail "Docker no esta accesible. Agrega tu usuario al grupo docker o usa una sesion con permisos."
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

env_value() {
  local key="$1"
  local default_value="$2"
  if [[ -f .env ]]; then
    local value
    value="$(awk -F= -v key="$key" '$1 == key {print substr($0, index($0, "=") + 1)}' .env | tail -n 1)"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
  fi
  printf '%s' "$default_value"
}

detect_interface() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") {print $(i + 1); exit}}'
  fi
}

create_env_if_missing() {
  if [[ -f .env ]]; then
    log ".env ya existe; no se sobrescribe."
    return
  fi

  local iface
  iface="$(detect_interface)"
  iface="${iface:-wlp0s20f3}"

  log "Creando .env minimo con interfaz detectada: $iface"
  cat > .env <<EOF
STACK_VERSION=8.19.14
SURICATA_MODE=ips
SURICATA_INTERFACE=$iface

BACKEND_TELEGRAM_BOT_TOKEN=${BACKEND_TELEGRAM_BOT_TOKEN:-}
BACKEND_ABUSEIPDB_KEY=${BACKEND_ABUSEIPDB_KEY:-}
EOF
}

wait_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  local delay="${4:-3}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name disponible."
      return
    fi
    sleep "$delay"
  done

  fail "$name no respondio en $((attempts * delay)) segundos: $url"
}

prompt_admin_credentials() {
  if [[ -n "${DEV_ADMIN_USERNAME:-}" && -n "${DEV_ADMIN_PASSWORD:-}" ]]; then
    ADMIN_USERNAME="$DEV_ADMIN_USERNAME"
    ADMIN_PASSWORD="$DEV_ADMIN_PASSWORD"
    ADMIN_EMAIL="${DEV_ADMIN_EMAIL:-$ADMIN_USERNAME@suricata.local}"
    return
  fi

  printf '\nNuevo admin para reemplazar/desactivar el usuario bootstrap.\n'
  while [[ -z "${ADMIN_USERNAME:-}" ]]; do
    read -r -p "Usuario admin nuevo: " ADMIN_USERNAME
  done

  ADMIN_EMAIL="${DEV_ADMIN_EMAIL:-}"
  read -r -p "Email [$ADMIN_USERNAME@suricata.local]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-$ADMIN_USERNAME@suricata.local}"

  local password_again=""
  while true; do
    read -r -s -p "Password admin nuevo (min 8 chars): " ADMIN_PASSWORD
    printf '\n'
    read -r -s -p "Confirmar password: " password_again
    printf '\n'
    if [[ "$ADMIN_PASSWORD" != "$password_again" ]]; then
      printf 'Las contrasenas no coinciden.\n' >&2
      continue
    fi
    if [[ "${#ADMIN_PASSWORD}" -lt 8 ]]; then
      printf 'La contrasena debe tener al menos 8 caracteres.\n' >&2
      continue
    fi
    break
  done
}

csrf_from_cookie() {
  local cookie_file="$1"
  awk '/suricata_csrf/ {print $7}' "$cookie_file" | tail -n 1
}

login_user() {
  local username="$1"
  local password="$2"
  local cookie_file="$3"
  local response_file
  local status
  response_file="$(mktemp)"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -c "$cookie_file" -b "$cookie_file" \
    -X POST "$API_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(USERNAME="$username" PASSWORD="$password" python3 - <<'PY'
import json
import os
print(json.dumps({"username": os.environ["USERNAME"], "password": os.environ["PASSWORD"]}))
PY
)")"
  if [[ "$status" == "200" ]]; then
    rm -f "$response_file"
    return 0
  fi
  printf 'Login fallo para %s (HTTP %s): %s\n' "$username" "$status" "$(tr '\n' ' ' < "$response_file")" >&2
  rm -f "$response_file"
  return 1
}

api_json() {
  local method="$1"
  local path="$2"
  local cookie_file="$3"
  local body="$4"
  local response_file="$5"
  local csrf
  csrf="$(csrf_from_cookie "$cookie_file")"
  [[ -n "$csrf" ]] || fail "No se encontro cookie CSRF en $cookie_file"

  curl -sS -o "$response_file" -w '%{http_code}' -b "$cookie_file" \
    -X "$method" "$API_URL$path" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf" \
    -d "$body"
}

create_or_reuse_admin() {
  local body
  local response_file
  local status
  body="$(ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" python3 - <<'PY'
import json
import os
print(json.dumps({
    "username": os.environ["ADMIN_USERNAME"],
    "email": os.environ["ADMIN_EMAIL"],
    "password": os.environ["ADMIN_PASSWORD"],
    "roles": ["admin"],
    "is_active": True,
}))
PY
)"
  response_file="$(mktemp)"
  status="$(api_json POST /api/auth/users "$BOOTSTRAP_COOKIE_FILE" "$body" "$response_file")"
  if [[ "$status" == "201" ]]; then
    log "Admin '$ADMIN_USERNAME' creado."
  elif [[ "$status" == "400" ]] && grep -qi 'username ya existe' "$response_file"; then
    log "Admin '$ADMIN_USERNAME' ya existe; se reutilizara para login."
  else
    fail "No se pudo crear admin '$ADMIN_USERNAME' (HTTP $status): $(tr '\n' ' ' < "$response_file")"
  fi
  rm -f "$response_file"
}

user_id_by_username() {
  local cookie_file="$1"
  local username="$2"
  curl -fsS -b "$cookie_file" "$API_URL/api/auth/users" | USERNAME="$username" python3 -c '
import json
import os
import sys

data = json.load(sys.stdin)
username = os.environ["USERNAME"]
for user in data.get("users", []):
    if user.get("username") == username:
        print(user.get("id", ""))
        break
'
}

deactivate_bootstrap_admin() {
  local bootstrap_username="$1"
  if [[ "$ADMIN_USERNAME" == "$bootstrap_username" ]]; then
    log "El admin nuevo tiene el mismo username que el bootstrap; no se desactiva."
    return
  fi

  local bootstrap_id
  bootstrap_id="$(user_id_by_username "$COOKIE_FILE" "$bootstrap_username")"
  if [[ -z "$bootstrap_id" ]]; then
    log "Usuario bootstrap '$bootstrap_username' no existe; no hay nada que desactivar."
    return
  fi

  local response_file
  local status
  response_file="$(mktemp)"
  status="$(api_json DELETE "/api/auth/users/$bootstrap_id" "$COOKIE_FILE" '{}' "$response_file")"
  if [[ "$status" == "200" ]]; then
    log "Usuario bootstrap '$bootstrap_username' desactivado."
  else
    fail "No se pudo desactivar '$bootstrap_username' (HTTP $status): $(tr '\n' ' ' < "$response_file")"
  fi
  rm -f "$response_file"
}

active_profile_id() {
  curl -fsS -b "$COOKIE_FILE" "$API_URL/api/suricata/profiles" | python3 -c '
import json
import sys

profiles = json.load(sys.stdin)
for profile in profiles:
    if profile.get("is_active"):
        print(profile.get("id", ""))
        break
'
}

apply_active_profile() {
  local profile_id
  profile_id="$(active_profile_id)"
  [[ -n "$profile_id" ]] || fail "No hay perfil Suricata activo para aplicar."

  local response_file
  local status
  response_file="$(mktemp)"
  status="$(api_json POST /api/suricata/apply "$COOKIE_FILE" "{\"profile_id\":\"$profile_id\"}" "$response_file")"
  if [[ "$status" == "200" ]]; then
    log "Perfil Suricata activo aplicado: $profile_id"
  else
    fail "No se pudo aplicar perfil Suricata (HTTP $status): $(tr '\n' ' ' < "$response_file")"
  fi
  rm -f "$response_file"
}

verify_runtime() {
  log "Verificando stack."
  compose ps
  curl -fsS "$API_URL/api/events/health" >/dev/null
  curl -fsSI "$FRONTEND_URL" >/dev/null
  docker_cmd exec redis redis-cli PING >/dev/null
  docker_cmd exec suricata iptables -L OUTPUT -n | grep -q NFQUEUE || fail "No se encontro NFQUEUE en OUTPUT."

  local rule_count
  rule_count="$(docker_cmd exec suricata wc -l /var/lib/suricata/rules/suricata.rules | awk '{print $1}')"
  [[ "$rule_count" -gt 0 ]] || fail "Suricata no tiene reglas cargadas."
  log "Suricata tiene $rule_count lineas de reglas."
  curl -fsS -b "$COOKIE_FILE" "$API_URL/api/suricata/status" >/dev/null
  curl -fsS -b "$COOKIE_FILE" "$API_URL/api/events/stats?hours=24" >/dev/null
}

main() {
  create_env_if_missing

  log "Levantando stack con Docker Compose."
  compose up -d --build

  wait_http 'http://localhost:9200' Elasticsearch 80 3
  wait_http "$API_URL/api/events/health" Backend 80 3
  wait_http "$FRONTEND_URL" Frontend 80 3

  prompt_admin_credentials

  local bootstrap_username
  local bootstrap_password
  bootstrap_username="$(env_value BACKEND_INITIAL_ADMIN_USERNAME admin)"
  bootstrap_password="$(env_value BACKEND_INITIAL_ADMIN_PASSWORD admin123)"

  rm -f "$COOKIE_FILE" "$BOOTSTRAP_COOKIE_FILE"
  if login_user "$bootstrap_username" "$bootstrap_password" "$BOOTSTRAP_COOKIE_FILE"; then
    log "Login bootstrap correcto: $bootstrap_username"
    create_or_reuse_admin
  else
    log "No se pudo usar bootstrap; se intentara login con '$ADMIN_USERNAME'."
  fi

  login_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD" "$COOKIE_FILE" || fail "No se pudo iniciar sesion con el admin nuevo."
  log "Login admin operativo: $ADMIN_USERNAME"

  deactivate_bootstrap_admin "$bootstrap_username"
  apply_active_profile
  verify_runtime

  cat <<EOF

Stack listo.
- Frontend: $FRONTEND_URL
- Backend:  $API_URL
- Usuario:  $ADMIN_USERNAME
- El usuario bootstrap '$bootstrap_username' quedo desactivado si existia y era distinto.
EOF
}

main "$@"

#!/usr/bin/env sh
set -eu

ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://elasticsearch:9200}"

put_json() {
  path="$1"
  file="$2"
  curl --fail --silent --show-error \
    --request PUT \
    --header "Content-Type: application/json" \
    --data-binary "@$file" \
    "$ELASTICSEARCH_URL$path"
  printf '\n'
}

printf 'Applying Elasticsearch ILM policy and index templates at %s\n' "$ELASTICSEARCH_URL"
put_json "/_ilm/policy/suricata-1-year" "/setup/ilm/suricata-ilm.json"
put_json "/_index_template/suricata-template" "/setup/templates/suricata-template.json"
put_json "/_index_template/suricata-enriched-template" "/setup/templates/suricata-enriched-template.json"
printf 'Elasticsearch index management applied.\n'

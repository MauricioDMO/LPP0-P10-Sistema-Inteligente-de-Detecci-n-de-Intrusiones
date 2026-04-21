FROM debian:12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  suricata \
  iproute2 \
  iputils-ping \
  ca-certificates \
  curl \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && mkdir -p /var/log/suricata /var/lib/suricata/rules

ENTRYPOINT ["/entrypoint.sh"]

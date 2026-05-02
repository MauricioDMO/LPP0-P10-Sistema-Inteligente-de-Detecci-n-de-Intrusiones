FROM debian:12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  suricata \
  iptables \
  iproute2 \
  iputils-ping \
  ca-certificates \
  curl \
  procps \
  libcap2-bin \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && sed -i 's/\r$//' /entrypoint.sh \
  && mkdir -p /var/log/suricata /var/lib/suricata/rules

ENTRYPOINT ["/entrypoint.sh"]

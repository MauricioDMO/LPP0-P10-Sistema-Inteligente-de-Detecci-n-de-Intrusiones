FROM jasonish/suricata:latest

# Install iptables for IPS mode (NFQUEUE)
RUN dnf install -y iptables-nft && dnf clean all

# Copy configuration and entrypoint
COPY config/suricata.yaml /etc/suricata/suricata.yaml
COPY config/classification.config /etc/suricata/classification.config
COPY config/reference.config /etc/suricata/reference.config
COPY config/threshold.config /etc/suricata/threshold.config
COPY config/rules /var/lib/suricata/rules
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

ARG STACK_VERSION=8.19.14
FROM docker.elastic.co/beats/filebeat:${STACK_VERSION}

USER root
RUN mkdir -p /usr/share/filebeat/modules.d
USER filebeat

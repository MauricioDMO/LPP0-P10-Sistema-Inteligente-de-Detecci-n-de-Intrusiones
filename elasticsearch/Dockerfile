ARG STACK_VERSION=8.19.14
FROM docker.elastic.co/elasticsearch/elasticsearch:${STACK_VERSION}

COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY jvm.options.d/ /usr/share/elasticsearch/config/jvm.options.d/

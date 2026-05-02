# Logstash

Logstash recibe eventos de Filebeat y los distribuye a Elasticsearch y Redis.

## Rol en el proyecto

Filebeat solo permite un output activo. Logstash resuelve esa limitacion actuando como distribuidor:

- Elasticsearch recibe el historico.
- Redis recibe eventos realtime por Pub/Sub.

## Configuracion real

Archivo: `logstash/logstash.conf`

```conf
input {
  beats {
    port => 5044
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "suricata-%{+YYYY.MM.dd}"
  }

  redis {
    host => "redis"
    port => 6379
    key => "suricata"
    data_type => "channel"
  }
}
```

Compose limita la JVM con `LS_JAVA_OPTS=-Xmx256m -Xms256m` y espera a que Elasticsearch este sano antes de iniciar.

## Flujo

```text
Filebeat -> Logstash:5044
Logstash -> Elasticsearch:9200 -> indices suricata-YYYY.MM.dd
Logstash -> Redis:6379 -> canal suricata
```

## Validacion rapida

Estado del servicio:

```bash
docker compose ps logstash
```

Pipeline activa:

```bash
docker logs logstash | grep "Pipelines running"
```

Errores:

```bash
docker logs logstash | grep -i "error\|exception"
```

## Riesgos

- Si Elasticsearch esta caido, el historico no se indexa.
- Si Redis esta caido, el realtime no recibe eventos.
- No hay cola persistente configurada en Logstash.
- 256 MB de heap es suficiente para laboratorio, no necesariamente para carga alta.

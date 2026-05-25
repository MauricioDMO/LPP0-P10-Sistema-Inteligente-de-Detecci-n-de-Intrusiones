# Redis

Redis entrega eventos en tiempo real mediante Pub/Sub. No se usa como almacenamiento permanente.

## Rol en el proyecto

- Logstash publica eventos en el canal `suricata`.
- Backends, dashboards o scripts pueden suscribirse al canal.
- Elasticsearch sigue siendo la fuente historica de datos.

## Configuracion real

En Logstash:

```conf
redis {
  host => "redis"
  port => 6379
  key => "suricata"
  data_type => "channel"
}
```

En desarrollo, Redis se publica como `localhost:6379`.

En produccion basica, Redis se publica solo en `127.0.0.1:6379`.

## Pub/Sub

Pub/Sub entrega baja latencia, pero no guarda mensajes. Si no hay suscriptores conectados, el evento publicado se pierde para Redis.

Esto es aceptable en este proyecto porque los mismos eventos tambien se almacenan en Elasticsearch.

## Validacion rapida

Usar [Redis realtime](../05-Referencia/Comandos.md#redis-realtime) y [Inicio y verificacion](../03-Operacion/Inicio-y-Verificacion.md#3-redis).

## Riesgos

Riesgos y mitigacion: [Seguridad](../05-Referencia/Seguridad.md).

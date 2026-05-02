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

Comprobar servicio:

```bash
docker exec redis redis-cli PING
```

Suscribirse al canal:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

En otra terminal, generar trafico:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
```

Ver numero de suscriptores:

```bash
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

## Riesgos

- Pub/Sub no persiste eventos.
- Redis no tiene autenticacion en la configuracion actual.
- Si Redis reinicia, los suscriptores pierden conexion.
- Para entrega garantizada se requiere otro patron, por ejemplo Redis Streams, List o una cola dedicada.

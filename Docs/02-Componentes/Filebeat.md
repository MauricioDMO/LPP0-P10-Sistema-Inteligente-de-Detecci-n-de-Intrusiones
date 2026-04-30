# Filebeat

## Que es

Filebeat es un lightweight shipper de logs de Elastic. Lee archivos de log, parsea eventos y los envia a un destino como Elasticsearch.

## Por que se usa en este proyecto

- Conecta Suricata con Elasticsearch sin desarrollar un parser propio.
- Soporta modulo oficial de Suricata para EVE JSON.
- Permite centralizar y normalizar eventos para consulta en Kibana.

## Como esta configurado aqui

### Config principal

Archivo: `filebeat/filebeat.yml`

Configuracion activa:

- Carga de modulos desde `modules.d/*.yml`
- Output a `logstash:5044` (Logstash, puerto 5044)
- Integracion con Kibana en `http://kibana:5601`
- Logging por stderr (ideal para `docker logs`)

**Cambio importante**: Output fue migrado de Elasticsearch directo a Logstash. Razón: Filebeat solo permite UN output, pero necesitamos dos destinos (Elasticsearch + Redis). Logstash actúa como multiplexer distribuidor.

### Modulo Suricata

Archivo: `filebeat/modules.d/suricata.yml`

- Modulo `suricata` habilitado.
- Input apuntando a `/var/log/suricata/eve.json`.

### Ejecucion en Compose

- Corre como `user: root` para evitar fricciones de permisos.
- Usa `--strict.perms=false`.
- Depende de Elasticsearch healthy y de inicio de Suricata/Kibana.

## Flujo de datos

1. Lee `eve.json` del volumen `suricata-logs`.
2. Aplica parsing del modulo Suricata.
3. Envia eventos al puerto 5044 (Logstash beats input).
4. Logstash distribuye a Elasticsearch (histórico) y Redis (realtime).
5. Permite exploracion inmediata en Kibana y consumo realtime en aplicaciones.

## Buenas practicas

- Ejecutar setup inicial una vez para assets en Kibana:

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

- Mantener `filebeat-data` persistente para no reingerir todo el archivo tras reinicios.
- Revisar logs de Filebeat cuando no aparezcan eventos en indices.

## Riesgos y limitaciones

- Si `eve.json` no existe o no crece, no habra eventos.
- `strict.perms=false` simplifica pero oculta fallas de permisos.
- Sin pipeline custom avanzado para enriquecimiento adicional.

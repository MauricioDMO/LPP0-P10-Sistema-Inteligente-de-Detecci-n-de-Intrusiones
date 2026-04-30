# Logstash

## Qué es

Logstash es un procesador de eventos open-source de Elastic. Consume datos de múltiples fuentes (inputs), aplica transformaciones (filtros) y envía el resultado a múltiples destinos (outputs) de forma simultánea.

## Por qué se usa en este proyecto

El problema original: **Filebeat solo permite UN output**. En este proyecto necesitábamos que los eventos llegaran a **dos destinos simultáneamente**:

1. **Elasticsearch** → para análisis histórico y visualización en Kibana
2. **Redis** → para consumo en tiempo real (realtime pipeline)

Logstash resuelve esto actuando como un multiplexer: recibe eventos de Filebeat y los distribuye a múltiples destinos de forma paralela.

Sin Logstash, tendríamos dos opciones malas:
- Ejecutar dos instancias de Filebeat (duplicación, complejidad)
- Elegir un solo destino (pérdida de capacidad realtime u histórica)

## Cómo está configurado aquí

### Archivo de configuración

Ubicación: `logstash/logstash.conf`

```
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

**Explicación:**

- **input**: Escucha en puerto 5044 eventos del protocolo Beats (el que usa Filebeat)
- **output elasticsearch**: Envía eventos a Elasticsearch con índices diarios `suricata-YYYY.MM.dd`
- **output redis**: Publica eventos en el canal Redis `suricata` (datos en tiempo real)

### Ejecución en Docker Compose

Archivo: `docker-compose.yml` y `docker-compose.prod.yml`

```yaml
logstash:
  build:
    context: ./logstash
    args:
      STACK_VERSION: ${STACK_VERSION}
  container_name: logstash
  depends_on:
    elasticsearch:
      condition: service_healthy
  volumes:
    - ./logstash/logstash.conf:/usr/share/logstash/pipeline/logstash.conf:ro
  environment:
    - "LS_JAVA_OPTS=-Xmx256m -Xms256m"
  restart: unless-stopped
```

**Parámetros clave:**

- `depends_on elasticsearch`: Logstash espera a que Elasticsearch esté sano antes de iniciar
- `/usr/share/logstash/pipeline/logstash.conf:ro`: Configración inyectada en contenedor
- `LS_JAVA_OPTS`: Heap JVM limitado a 256MB (laboratorio; en producción puede ser mayor)

### Cambio en Filebeat

Filebeat ahora apunta a Logstash en lugar de Elasticsearch directo:

```yaml
output.logstash:
  hosts: ["logstash:5044"]
```

Esto permite que Filebeat envíe eventos en formato Beats al puerto 5044 donde Logstash los recibe.

## Flujo de datos

```
Suricata (eve.json)
    ↓
Filebeat (lee y parsea con módulo Suricata)
    ↓
Logstash (puerto 5044, input beats)
    ├→ Elasticsearch (índices suricata-*)
    └→ Redis (canal suricata, realtime)
```

## Validaciones útiles

### Verificar que Logstash está corriendo

```bash
docker compose ps
```

Debería mostrar logstash en estado "Up".

### Verificar que la pipeline está activa

```bash
docker logs logstash | grep "Pipelines running"
```

Debería mostrar algo como:

```
[logstash.agent] Pipelines running {:count=>2, :running_pipelines=>[:".monitoring-logstash", :main], :non_running_pipelines=>[]}
```

### Verificar conexión desde Filebeat

```bash
docker logs filebeat | grep -i logstash
```

Debería mostrar logs indicando conexión a logstash.

### API de monitoreo de Logstash

```bash
docker exec logstash curl -s localhost:9600 | jq .
```

Devuelve información sobre la instancia de Logstash (versión, pipelines, uptime, etc).

## Buenas prácticas

1. **Mantener configuración simple**: Por ahora, Logstash solo pasa eventos sin transformación. Esto mantiene el sistema predictible.

2. **No modificar indices en Elasticsearch**: Logstash crea índices con patrón `suricata-YYYY.MM.dd` de forma automática. No modificar este patrón sin razón.

3. **Monitorar Logstash JVM**: En cargas altas, los 256MB pueden no ser suficientes. Ajustar `LS_JAVA_OPTS` en docker-compose si es necesario.

4. **Volumen de configuración**: La configuración es inyectada como solo lectura (`:ro`). Para cambios, editar archivo local y reiniciar Logstash.

## Riesgos y limitaciones

1. **Sin persistencia de Redis**: El canal Pub/Sub de Redis no persiste mensajes. Si no hay suscriptores, el evento se pierde. Para buffer duradero, se puede agregar un output Redis adicional con `data_type => "list"`.

2. **Dependencia de Elasticsearch**: Si Elasticsearch cae, Logstash retendrá eventos en memoria hasta que se recupere (con límites). Monitorear salud de Elasticsearch.

3. **Un solo Logstash**: Actual configuración es single-node. Para alta disponibilidad, se requeriría cluster de Logstash con coordinación (futura mejora).

4. **Overhead de procesamiento**: Cada evento pasa por Logstash. En volúmenes muy altos (>10k eventos/seg), considerar optimizaciones de CPU/memoria o sharding.

## Próximas mejoras

- Agregar filtros para enriquecimiento de datos (GeoIP, conversión de campos)
- Agregar alertas dentro de Logstash para eventos críticos
- Persistencia en Redis con `data_type => "list"` para eventos que requieran garantía de entrega
- Monitoreo de métricas de Logstash (throughput, latencia, errores)

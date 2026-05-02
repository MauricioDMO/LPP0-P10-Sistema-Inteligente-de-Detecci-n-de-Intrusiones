# Arquitectura del Stack

## Vista general

El sistema implementa un **pipeline dual** de Network Security Monitoring:

1. **Pipeline Histórico**: Persiste eventos en Elasticsearch para análisis retrospectivo, búsqueda y visualización en Kibana.
2. **Pipeline Realtime**: Distribuye eventos en tiempo real a través de Redis Pub/Sub para consumo inmediato en dashboards y backends.

Flujo end-to-end:

1. Suricata captura paquetes de una interfaz del host.
2. Suricata escribe eventos EVE JSON en `eve.json`.
3. Filebeat consume `eve.json` y lo parsea con el módulo de Suricata.
4. Filebeat envía documentos a Logstash (puerto 5044).
5. Logstash recibe eventos y los distribuye:
   - A Elasticsearch para almacenamiento histórico
   - A Redis para consumo realtime
6. Kibana consulta Elasticsearch para exploración y visualización.
7. Aplicaciones (backend FastAPI, dashboards) se suscriben a Redis canal `suricata` para eventos en vivo.

## Diagrama logico

```mermaid
flowchart TD
    A["Host Network Interface"] --> B["Suricata - container host network privileged"]
    B --> C["/var/log/suricata/eve.json - volumen compartido"]
    C --> D["Filebeat - módulo Suricata"]
    D --> E["Logstash - input beats, port 5044"]
    E --> F["Elasticsearch - single node, índices suricata-*"]
    E --> G["Redis - canal Pub/Sub 'suricata'"]
    F --> H["Kibana - visualización histórica"]
    G --> I["Aplicaciones (FastAPI, Dashboards) - suscriptores realtime"]
```

## Decisiones tecnicas actuales

### 1) Docker Compose como orquestador

Se usa Compose para levantar servicios con una sola definicion versionada y reproducible, con volumenes persistentes y dependencias entre servicios.

### 2) Suricata en `network_mode: host`

Se usa host networking para captura real de paquetes del host. En modo bridge, el contenedor no ve el trafico del host de forma equivalente.

### 3) Volumen compartido para logs de Suricata
Logstash como multiplexer

**Problema**: Filebeat solo permite UN output. Se necesitaban dos destinos simultáneamente.

**Solución**: Logstash recibe eventos de Filebeat y distribuye a múltiples outputs (Elasticsearch + Redis).

**Alternativas rechazadas**:
- Ejecutar dos instancias de Filebeat → duplicación innecesaria
- Elegir un solo destino → pérdida de capacidad histórica o realtime

Logstash es la solución estándar de Elastic para este tipo de distribución.

### 5) Elasticsearch en single-node
Elasticsearch debe estar sano (healthcheck OK) antes de que Logstash inicie
- Logstash debe estar corriendo antes de que Filebeat se conecte
- Kibana depende de Elasticsearch sano (healthcheck OK)
- Suricata inicia independiente, capturando desde la interfaz definida en `.env`
- Redis inicia independiente, esperando suscriptores

Orden de inicio típico (automático en Compose):

```
1. redis
2. elasticsearch (espera a healthcheck)
3. logstash (depende de elasticsearch healthy)
4. filebeat (depende de logstash started)
5. suricata (independiente)
6. kibana (depende de elasticsearch healthy)
```
### 6) Redis Pub/Sub para realtime

**Canal vs. List**:
- **Channel** (Pub/Sub): sin persistencia, latencia mínima (~1ms), ideal para eventos en vivo
- **List**: persistencia, latencia ~1ms, ideal para queue/buffer durable

Se eligió **Channel** porque los eventos ya se persisten en Elasticsearch, y se necesita latencia mínima para dashboards realtime.

### 7) Modos de red de Suricata

El proyecto soporta tres modos operativos:

- `local-ips`: modo normal actual. El contenedor agrega NFQUEUE en `OUTPUT` para inspeccionar trafico generado por el host/VM.
- `ids`: modo pasivo. Suricata captura en una o varias interfaces definidas por `SURICATA_INTERFACE`.
- `gateway-ips`: modo gateway L3. La VM host aplica NAT, DHCP y NFQUEUE en `FORWARD`; el contenedor solo ejecuta Suricata con `-q`.

`docker-compose.yml` usa el modo normal/local. `docker-compose.gateway.yml` es standalone y se usa cuando la VM Debian actua como gateway para clientes de una LAN.

### 8) Configuracion de laboratorio

Configuracion enfocada en laboratorio y aprendizaje. Simplifica operacion, pero no representa alta disponibilidad ni hardening empresarial.

## Dependencias de arranque

- Redis sin autenticacion y Pub/Sub sin persistencia
- Dependencia fuerte de la interfaz de red configurada
- Requiere permisos elevados para captura con Suricata
- Ajustes de kernel/memoria pueden ser necesarios en Linux
- Si Redis se reinicia, suscriptores pierden conexión y eventos en tránsito desaparecen.
- En modo gateway, si Suricata no escucha NFQUEUE, el trafico de clientes puede quedar bloqueado hasta limpiar reglas.

## Persistencia

- `esdata`: datos indexados.
- `eslogs`: logs internos de Elasticsearch.
- `filebeat-data`: estado de lectura de Filebeat.
- `suricata-logs`: `eve.json` y otros logs de Suricata.
- Redis: en memoria, sin volumen persistente.

## Riesgos conocidos

- Exposicion de puertos 9200 y 5601 sin autenticacion.
- Dependencia fuerte de la interfaz de red configurada.
- Requiere permisos elevados para captura con Suricata.
- Ajustes de kernel/memoria pueden ser necesarios en Linux.
- En modo gateway, una mala seleccion de `WAN_IF`/`LAN_IF` puede cortar conectividad del laboratorio.

## Siguientes mejoras

1. Habilitar seguridad de Elastic y agregar autenticacion en Redis.
2. Restringir puertos con firewall o bind a interfaces especificas.
3. Agregar monitoreo y alertas sobre salud del stack.
4. Integrar backend para consultas controladas y consumo de eventos realtime.
5. Persistencia opcional en Redis con estructura List para eventos criticos.
6. Enriquecimiento de eventos en Logstash para mejor analisis.

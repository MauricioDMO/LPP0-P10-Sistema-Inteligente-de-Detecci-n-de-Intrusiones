# Captura PCAP Bajo Demanda

## Objetivo

Permitir capturar trafico relacionado con una alerta para analisis forense.

## Estrategia

Usar `tcpdump` dentro de un contenedor con permisos de red o dentro del host network.

## Opcion recomendada

Crear servicio:

- `pcap-capture`

Con:

- `network_mode: host`
- `cap_add: NET_ADMIN, NET_RAW`
- volumen compartido: `pcap-data`

## Backend endpoints

- `POST /api/pcap/captures`
- `GET /api/pcap/captures`
- `GET /api/pcap/captures/{id}/download`
- `DELETE /api/pcap/captures/{id}`

## Parametros

- source_ip
- destination_ip
- port
- duration_seconds
- reason
- linked_event_id

## PostgreSQL

Tabla `PcapCapture`:

- id
- filename
- filter
- status
- started_at
- finished_at
- requested_by
- linked_event_id

## Seguridad

Requiere JWT.

Roles:

- admin
- analyst

## Frontend

Agregar accion en tabla de eventos:

- Capturar PCAP

Agregar ruta:

- `/pcap`

## Validacion

- Lanzar captura de 10 segundos.
- Confirmar archivo `.pcap`.
- Descargar desde frontend.
- Abrir con Wireshark/tcpdump.

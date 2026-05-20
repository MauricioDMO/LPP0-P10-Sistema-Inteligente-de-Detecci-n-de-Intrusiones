# Timeline De Incidentes

## Objetivo

Permitir investigar una IP, dominio, alerta o evento agrupando actividad relacionada.

## Entidades

PostgreSQL:

- `Incident`
- `IncidentEvent`
- `IncidentComment`
- `IncidentStatusHistory`

Estados:

- new
- investigating
- confirmed
- false_positive
- mitigated
- closed

## Backend endpoints

- `POST /api/incidents`
- `GET /api/incidents`
- `GET /api/incidents/{id}`
- `PATCH /api/incidents/{id}`
- `POST /api/incidents/{id}/events`
- `POST /api/incidents/{id}/comments`
- `GET /api/incidents/timeline`

## Timeline automatico

Dado un indicador:

- source_ip
- destination_ip
- domain
- signature

Buscar en Elasticsearch:

- primera aparicion.
- ultima aparicion.
- eventos relacionados.
- firmas relacionadas.
- paises/ISPs.
- severidades.
- bloqueos asociados.
- PCAPs asociados.

## Frontend

Agregar ruta:

- `/incidents`

Vista detalle:

- resumen.
- timeline cronologico.
- eventos relacionados.
- mapa si hay GeoIP.
- PCAPs vinculados.
- comentarios.
- cambio de estado.

## Seguridad

- `admin`: todo.
- `analyst`: crear/editar incidentes.
- `viewer`: solo lectura.

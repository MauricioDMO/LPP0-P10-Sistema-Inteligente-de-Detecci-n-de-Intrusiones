# Listas Negras y Blancas

## Objetivo

Administrar dominios/IPs bloqueadas o permitidas desde frontend y convertirlas en reglas Suricata gestionadas.

## Entidades

PostgreSQL:

- `BlockListEntry`
- `AllowListEntry`

Campos:

- type: domain, ip, cidr
- value
- reason
- enabled
- created_by
- created_at
- updated_at

## Generacion de reglas

Para dominios:

- DNS query.
- TLS SNI.
- HTTP host.

Para IPs:

- reglas `drop` o `reject` hacia IP destino.
- opcion para origen si se requiere.

## Endpoints

- `GET /api/lists/block`
- `POST /api/lists/block`
- `PATCH /api/lists/block/{id}`
- `DELETE /api/lists/block/{id}`
- `GET /api/lists/allow`
- `POST /api/lists/allow`
- `PATCH /api/lists/allow/{id}`
- `DELETE /api/lists/allow/{id}`
- `POST /api/lists/apply`

## Frontend

Agregar ruta:

- `/lists`

Funciones:

- agregar dominio/IP.
- habilitar/deshabilitar.
- aplicar cambios.
- ver reglas generadas.

## Nota importante

Las listas blancas deben implementarse con cuidado porque Suricata IPS puede no permitir explicitamente si una regla posterior bloquea. La whitelist debe reflejarse en condiciones de exclusion o prioridad de reglas.

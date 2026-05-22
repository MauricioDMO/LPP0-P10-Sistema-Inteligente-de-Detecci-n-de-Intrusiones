# Listas Negras y Blancas

## Objetivo

Administrar dominios/IPs bloqueadas o permitidas desde frontend y convertirlas en politicas que usan el motor de gestion Suricata definido en `05-gestion-reglas-suricata.md`.

Este modulo no debe escribir archivos ni ejecutar `suricata-update` directamente. Debe crear/actualizar entidades en PostgreSQL y delegar la generacion/aplicacion al flujo `/api/suricata/apply`.

## Dependencias

Requiere antes:

- PostgreSQL + ORM + JWT.
- Gestion Suricata por perfiles, fuentes, overrides, reglas custom y jobs.

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

La salida debe convertirse en reglas custom asociadas al perfil activo o a un perfil seleccionado, no en archivos editados manualmente. La aplicacion final ocurre con el job de Suricata.

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

`POST /api/lists/apply` no debe duplicar la logica de aplicacion. Debe invocar o crear un job equivalente a `/api/suricata/apply` para el perfil afectado.

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

Para el MVP, priorizar listas negras. Las listas blancas deben entrar despues de validar como se representaran las exclusiones en reglas generadas para evitar una falsa sensacion de bypass.

# Gestion de Reglas Suricata

## Objetivo

Permitir gestionar reglas Suricata desde el backend/frontend.

## Alcance

- Ver reglas cargadas.
- Crear regla simple.
- Habilitar/deshabilitar reglas.
- Validar sintaxis basica.
- Recargar Suricata con senal `USR2`.

## Seguridad

Requiere JWT.

Solo roles:

- `admin`
- `analyst`

## Persistencia

Usar PostgreSQL para registrar reglas gestionadas:

- `Rule`
- `RuleSet`
- `RuleChangeLog`

Campos:

- sid
- msg
- action
- protocol
- source
- destination
- ports
- classtype
- enabled
- raw_rule
- created_by

## Archivos Suricata

No editar reglas oficiales directamente.

Crear archivo gestionado:

- `suricata/config/rules/managed.rules`

Agregarlo al `suricata.yaml` si aun no esta incluido.

## Backend endpoints

- `GET /api/rules`
- `POST /api/rules`
- `PATCH /api/rules/{id}`
- `DELETE /api/rules/{id}`
- `POST /api/rules/reload`
- `POST /api/rules/validate`

## Recarga

Opcion practica:

- Backend ejecuta llamada Docker controlada para enviar `USR2`.

Opcion mas limpia:

- Crear servicio interno `suricata-control` o endpoint local dentro del contenedor.

## Frontend

Agregar ruta:

- `/rules`

Funciones:

- tabla de reglas.
- crear regla.
- activar/desactivar.
- boton recargar Suricata.
- historial de cambios.

## Validacion

- Crear regla.
- Confirmar que aparece en `managed.rules`.
- Recargar Suricata.
- Generar trafico que dispare regla.
- Confirmar evento en Elasticsearch.

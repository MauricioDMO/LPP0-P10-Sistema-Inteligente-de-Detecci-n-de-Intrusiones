# Threat Intel Gestionada En PostgreSQL

## Objetivo

Agregar gestion propia de inteligencia de amenazas usando PostgreSQL y JWT.

## Alcance

Ademas de AbuseIPDB, permitir administrar indicadores propios:

- IP maliciosa.
- Dominio malicioso.
- URL.
- Hash.
- ASN.
- Pais o ISP de riesgo.

## Modelo

Tabla `ThreatIndicator`:

- id
- indicator_type
- value
- source
- confidence
- severity
- tags
- description
- expires_at
- enabled
- created_by

Tabla `ThreatIntelHit`:

- id
- indicator_id
- event_timestamp
- source_ip
- destination_ip
- event_id
- matched_field

## Backend

Modificar `threat_intel.py`:

1. Revisar cache.
2. Consultar indicadores locales.
3. Consultar AbuseIPDB si aplica.
4. Combinar resultado en `_threat`.

## Endpoints

- `GET /api/threat-intel/indicators`
- `POST /api/threat-intel/indicators`
- `PATCH /api/threat-intel/indicators/{id}`
- `DELETE /api/threat-intel/indicators/{id}`
- `GET /api/threat-intel/hits`

## Frontend

Agregar ruta:

- `/threat-intel`

Funciones:

- CRUD de indicadores.
- filtros por tipo, severidad y fuente.
- visualizacion de matches.

## Seguridad

Requiere JWT.

- `admin`: CRUD completo.
- `analyst`: crear/editar indicadores.
- `viewer`: solo lectura.

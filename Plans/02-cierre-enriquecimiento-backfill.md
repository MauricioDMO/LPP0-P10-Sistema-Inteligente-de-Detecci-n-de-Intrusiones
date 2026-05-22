# Cierre De Enriquecimiento Persistente Y Backfill

## Objetivo

Cerrar las brechas pendientes del enriquecimiento persistente antes de avanzar con retencion, PostgreSQL y modulos administrativos.

El plan `01-enriquecimiento-persistente.md` define la arquitectura base. Este plan representa el cierre operativo: backfill historico, validacion de cobertura y ajustes de analytics para que `suricata-enriched-*` sea realmente fuente canonica.

## Estado actual esperado

Ya debe existir:

- Escritura de eventos enriquecidos en `suricata-enriched-YYYY.MM.dd`.
- Template enriquecido con `_geo.*.location` como `geo_point`.
- Backfill ejecutable desde backend.
- `/api/analytics/geo` consultando `suricata-enriched-*`.

## Brechas a cerrar

- Ejecutar backfill para datos historicos existentes en `suricata-*`.
- Confirmar que todos los dias relevantes tienen indice `suricata-enriched-*`.
- Confirmar que `_resolved`, `_geo` y `_threat` quedan persistidos.
- Confirmar que `_geo.source.location` y `_geo.destination.location` son `geo_point`.
- Confirmar que `/api/analytics/geo` no depende de `sample_size` ni de eventos crudos recientes.
- Agregar filtros historicos faltantes si se requieren para la presentacion:
  - `direction=source|destination|both`
  - `event_type=all|alert|dns|http|tls`
  - `only_blocked=true|false`
  - `only_malicious=true|false`
  - `min_count=1`

## Orden de trabajo

1. Revisar indices crudos disponibles con `GET /_cat/indices/suricata-*`.
2. Ejecutar backfill por rango razonable para no saturar GeoIP, DNS ni AbuseIPDB.
3. Validar documentos enriquecidos por dia.
4. Validar mapping de `geo_point`.
5. Ajustar `/api/analytics/geo` solo si faltan filtros necesarios.
6. Validar frontend `/geo` con periodo completo.
7. Documentar comandos de backfill en README o Docs.

## Validacion

- `GET /_cat/indices/suricata-enriched-*` muestra indices para los dias reprocesados.
- `GET suricata-enriched-*/_count` devuelve documentos del periodo esperado.
- Una muestra de documentos tiene `_resolved`, `_geo` y `_threat`.
- `GET suricata-enriched-*/_mapping` confirma `_geo.source.location` y `_geo.destination.location` como `geo_point`.
- `/api/analytics/geo?hours=24` responde desde indices enriquecidos.
- El mapa muestra metricas de periodo completo, no muestra reciente.

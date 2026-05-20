# Roadmap General

## Objetivo

Evolucionar el proyecto Suricata desde un dashboard SOC/IPS de laboratorio hacia una plataforma mas completa con persistencia enriquecida, gestion de reglas, autenticacion, PostgreSQL, retencion, salud del sistema, captura PCAP e investigacion por incidente.

## Orden de implementacion

- [x] 1. Enriquecimiento persistente.
- [ ] 2. Retencion Elasticsearch 1 ano.
- [ ] 3. PostgreSQL + ORM + JWT.
- [ ] 4. Gestion de reglas Suricata.
- [ ] 5. Listas negras y blancas.
- [ ] 6. Threat Intel gestionada en base de datos.
- [ ] 7. Dashboard de salud del stack.
- [ ] 8. Captura PCAP bajo demanda.
- [ ] 9. Timeline de incidentes.

## Dependencias clave

- El enriquecimiento persistente desbloquea analytics historicos confiables para geografia, threat intel y DNS inverso.
- La vista `/geo` debe depender de `suricata-enriched-*` y agregaciones del periodo completo, no de muestras recientes de eventos crudos.
- La retencion Elasticsearch debe incluir templates correctos para `geo_point`, keywords y campos `_threat` antes de usar el indice enriquecido como fuente canonica.

## Criterios generales

- Mantener compatibilidad con el pipeline actual.
- No eliminar el flujo Redis/WebSocket existente.
- Evitar romper dashboards actuales.
- Agregar endpoints nuevos bajo `/api`.
- Proteger endpoints administrativos con JWT.
- Documentar variables nuevas en `.env.example`.

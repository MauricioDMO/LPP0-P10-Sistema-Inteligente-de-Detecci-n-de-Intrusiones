# Roadmap General

## Objetivo

Evolucionar el proyecto Suricata desde un dashboard SOC/IPS de laboratorio hacia una plataforma mas completa con persistencia enriquecida, gestion de reglas, autenticacion, PostgreSQL, retencion, salud del sistema, captura PCAP e investigacion por incidente.

## Orden de implementacion recomendado

- [x] 1. Enriquecimiento persistente.
- [x] 2. Cerrar enriquecimiento persistente y backfill historico.
- [x] 3. Retencion Elasticsearch 1 ano y templates versionados.
- [ ] 4. PostgreSQL + ORM + JWT.
- [ ] 5. Gestion Suricata por perfiles, fuentes, overrides y jobs.
- [ ] 6. Listas negras y blancas sobre el motor de reglas gestionadas.
- [ ] 7. Threat Intel gestionada en base de datos.
- [ ] 8. Dashboard de salud del stack.
- [ ] 9. Captura PCAP bajo demanda.
- [ ] 10. Timeline de incidentes.

## Archivos por etapa

- `01-enriquecimiento-persistente.md`
- `02-cierre-enriquecimiento-backfill.md`
- `03-retencion-elasticsearch-1-anio.md`
- `04-postgres-orm-auth-jwt.md`
- `05-gestion-reglas-suricata.md`
- `06-listas-negras-blancas.md`
- `07-threat-intel-db.md`
- `08-dashboard-salud-stack.md`
- `09-captura-pcap.md`
- `10-timeline-incidentes.md`

## Dependencias clave

- El enriquecimiento persistente desbloquea analytics historicos confiables para geografia, threat intel y DNS inverso.
- La vista `/geo` debe depender de `suricata-enriched-*` y agregaciones del periodo completo, no de muestras recientes de eventos crudos.
- La retencion Elasticsearch debe incluir templates correctos para `geo_point`, keywords y campos `_threat` antes de usar el indice enriquecido como fuente canonica.
- PostgreSQL + JWT debe implementarse antes de cualquier modulo administrativo que cambie configuracion, porque reglas, listas, threat intel local, PCAP e incidentes necesitan usuarios, roles, auditoria y jobs persistidos.
- La gestion Suricata debe modelar politicas de seguridad en base de datos, no el YAML completo. FastAPI debe traducir esas politicas a archivos controlados para `suricata-update`.
- Las listas negras y blancas no deben duplicar la generacion de reglas: deben apoyarse en el motor de perfiles, overrides y reglas custom de Suricata.
- El dashboard de salud conviene implementarlo despues de PostgreSQL y gestion Suricata para incluir estado de jobs, perfil activo, versiones aplicadas, templates e indices.

## Criterios generales

- Mantener compatibilidad con el pipeline actual.
- No eliminar el flujo Redis/WebSocket existente.
- Evitar romper dashboards actuales.
- Agregar endpoints nuevos bajo `/api`.
- Proteger endpoints administrativos con JWT.
- Documentar variables nuevas en `.env.example`.
- No permitir que el frontend escriba archivos de configuracion directamente.
- Ejecutar comandos del sistema con argumentos fijos y `subprocess.run([...])`; nunca interpolar input de usuario en shell.

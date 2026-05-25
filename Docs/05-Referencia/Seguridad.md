# Seguridad

El stack esta optimizado para laboratorio y produccion basica local. No debe exponerse directamente a internet sin hardening adicional.

## Riesgos Actuales

- Suricata corre con privilegios elevados y `network_mode: host`.
- En modo IPS modifica reglas `iptables` e `ip6tables` mientras el contenedor esta activo.
- Elasticsearch tiene `xpack.security.enabled: false`.
- Redis no tiene autenticacion y Pub/Sub no persiste mensajes.
- Elasticsearch corre como single-node.
- Logstash no tiene cola persistente configurada.
- Las credenciales y secretos de laboratorio no son seguros para redes compartidas.

## Minimo Antes De Produccion

- Cambiar `BACKEND_JWT_SECRET` por un secreto largo y aleatorio.
- Cambiar `POSTGRES_PASSWORD` y reflejarlo en `BACKEND_DATABASE_URL`.
- Cambiar `BACKEND_INITIAL_ADMIN_PASSWORD` antes del primer arranque.
- Restringir puertos con firewall o publicar solo en `127.0.0.1` usando `docker-compose.prod.yml`.
- Habilitar seguridad de Elasticsearch si se manejan datos reales.
- Agregar autenticacion o aislamiento real para Redis si queda accesible fuera del host.
- Configurar TLS si hay acceso remoto al backend o frontend.
- Definir backups para `postgres-data` y `esdata`.
- Monitorear CPU, memoria, disco y crecimiento de indices.

## Reglas IPS

- Probar reglas nuevas primero con accion `alert`.
- Pasar a `drop` o `reject` solo despues de confirmar que el trafico coincidente es correcto.
- Evitar reglas demasiado amplias en IPS.
- Mantener `sid` unicos para reglas personalizadas.
- Documentar motivo, SID y perfil antes de aplicar cambios permanentes.

## Datos Sensibles

No versionar valores reales de:

- `BACKEND_TELEGRAM_BOT_TOKEN`
- `BACKEND_ABUSEIPDB_KEY`
- `BACKEND_JWT_SECRET`
- passwords de PostgreSQL
- credenciales administrativas reales

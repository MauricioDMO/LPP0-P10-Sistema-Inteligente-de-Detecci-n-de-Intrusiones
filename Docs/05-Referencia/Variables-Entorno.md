# Variables De Entorno

Referencia unica para las variables usadas por Docker Compose, backend y frontend.

## Archivo Base

Crear `.env` desde la raiz del proyecto:

```bash
cp .env.example .env
```

## Stack Y Suricata

```env
STACK_VERSION=8.19.14
SURICATA_MODE=ips
SURICATA_INTERFACE=wlp0s20f3
```

- `SURICATA_MODE=ips`: modo principal del proyecto. Usa NFQUEUE para inspeccion y bloqueo activo.
- `SURICATA_MODE=ids`: captura pasiva por interfaz.
- `SURICATA_INTERFACE`: se usa en modo IDS. Debe coincidir con una interfaz real del host; puede aceptar varias interfaces separadas por coma.

Listar interfaces disponibles:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## PostgreSQL Y Auth

```env
POSTGRES_DB=suricata
POSTGRES_USER=suricata
POSTGRES_PASSWORD=suricata
BACKEND_DATABASE_URL=postgresql+asyncpg://suricata:suricata@postgres:5432/suricata
BACKEND_JWT_SECRET=change-me
BACKEND_JWT_ALGORITHM=HS256
BACKEND_JWT_EXPIRES_MINUTES=480
BACKEND_INITIAL_ADMIN_USERNAME=admin
BACKEND_INITIAL_ADMIN_PASSWORD=admin123
BACKEND_INITIAL_ADMIN_EMAIL=admin@example.com
```

El admin inicial solo se crea si PostgreSQL no tiene usuarios. Cambiar `BACKEND_INITIAL_ADMIN_*` despues del primer arranque no actualiza usuarios existentes.

## Enriquecimiento Y Notificaciones

```env
BACKEND_TELEGRAM_BOT_TOKEN=
BACKEND_ABUSEIPDB_KEY=
BACKEND_GEOIP_DB_PATH=/data/GeoLite2-City.mmdb
MAXMIND_ACCOUNT_ID=
MAXMIND_LICENSE_KEY=
MAXMIND_EDITION_IDS=GeoLite2-City
MAXMIND_UPDATE_FREQUENCY=72
BACKEND_ENRICHED_INDEX_ENABLED=true
```

- `BACKEND_TELEGRAM_BOT_TOKEN`: token del bot usado por las notificaciones Telegram.
- `BACKEND_ABUSEIPDB_KEY`: habilita reputacion AbuseIPDB.
- `BACKEND_GEOIP_DB_PATH`: ruta del GeoLite2 City DB dentro del contenedor backend.
- `MAXMIND_ACCOUNT_ID`: ID de cuenta MaxMind usado por el servicio `geoipupdate`.
- `MAXMIND_LICENSE_KEY`: license key MaxMind usado para descargar GeoLite2.
- `MAXMIND_EDITION_IDS`: bases MaxMind a descargar. Para el backend debe incluir `GeoLite2-City`.
- `MAXMIND_UPDATE_FREQUENCY`: frecuencia de actualizacion de `geoipupdate` en horas.
- `BACKEND_ENRICHED_INDEX_ENABLED`: persiste copias enriquecidas en `suricata-enriched-*`.

### GeoLite2 City Local

El backend busca por defecto `GeoLite2-City.mmdb` en `/data/GeoLite2-City.mmdb`. Si no existe, usa fallback `ip-api.com`; el sistema funciona, pero depende de internet y puede ser mas lento o limitado por rate limits.

Para usar la base local, crea una cuenta gratuita en MaxMind y genera una license key:

1. Entra a <https://dev.maxmind.com/geoip/geolite2-free-geolocation-data>.
2. Crea una cuenta o inicia sesion en MaxMind.
3. Confirma el correo si MaxMind lo solicita.
4. En el portal de MaxMind, entra a `Account` y busca tu `Account ID`.
5. Entra a `Manage License Keys`.
6. Crea una nueva license key para GeoIP update.
7. Copia el `Account ID` en `MAXMIND_ACCOUNT_ID` y la key en `MAXMIND_LICENSE_KEY`.
8. Deja `MAXMIND_EDITION_IDS=GeoLite2-City`.
9. Activa el servicio con el perfil `geoip`; ver [Comandos](Comandos.md#geoip-local).

No guardes credenciales MaxMind dentro de Dockerfiles ni imagenes. Usa `.env` local o variables de entorno del host.

## Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

En produccion basica se mantiene el acceso local por defecto:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Si accedes desde otro host, estas URLs deben apuntar a la direccion visible desde el navegador.

## Produccion Basica

Antes del primer arranque cambia al menos:

- `POSTGRES_PASSWORD`
- `BACKEND_DATABASE_URL`
- `BACKEND_JWT_SECRET`
- `BACKEND_INITIAL_ADMIN_PASSWORD`

Revisa tambien las recomendaciones en [Seguridad](Seguridad.md).

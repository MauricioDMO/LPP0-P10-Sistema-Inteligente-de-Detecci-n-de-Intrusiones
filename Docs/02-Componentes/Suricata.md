# Suricata

Suricata es el motor IDS/IPS del proyecto. Inspecciona trafico de red, aplica reglas y genera eventos estructurados en formato EVE JSON.

## Rol en el proyecto

- Captura o intercepta trafico del host.
- Genera `/var/log/suricata/eve.json`.
- Aplica reglas locales para alertar o bloquear trafico.
- Entrega los eventos a Filebeat mediante el volumen `suricata-logs`.

## Configuracion real

Archivos principales:

- `suricata/Dockerfile`: parte de `jasonish/suricata:latest` e instala `iptables-nft` para modo IPS con NFQUEUE.
- `suricata/entrypoint.sh`: decide si arranca en modo `ips` o `ids`.
- `suricata/config/suricata.yaml`: configuracion principal.
- `backend/app/db/seed/suricata.py`: seed inicial de fuentes, perfil base y reglas locales gestionadas desde la UI.
- `backend/app/routes/suricata.py`: API de perfiles, fuentes, overrides, reglas custom, apply jobs y notificaciones.
- volumen Docker `suricata-rules`: salida runtime de `suricata-update`, incluyendo `suricata.rules`.

Compose ejecuta Suricata con:

- `network_mode: host`
- `privileged: true`
- capacidades `NET_ADMIN` y `NET_RAW`
- volumen `suricata-logs:/var/log/suricata`
- volumen `suricata-rules:/var/lib/suricata/rules`

## Modos de ejecucion

Modo IPS por defecto:

```env
SURICATA_MODE=ips
```

En IPS, el entrypoint agrega reglas `NFQUEUE` en `OUTPUT` y `FORWARD` para IPv4 e IPv6 y ejecuta Suricata con `-q 0`. Este modo permite que reglas `reject` o `drop` bloqueen trafico.

Modo IDS opcional:

```env
SURICATA_MODE=ids
SURICATA_INTERFACE=wlp0s20f3
```

En IDS, Suricata captura pasivamente desde una o varias interfaces separadas por coma:

```env
SURICATA_INTERFACE=wlp0s20f3,virbr0
```

## Reglas Locales

Las reglas locales ya no se cargan desde archivos estaticos del repo. Se guardan en PostgreSQL como **Reglas personalizadas** y se administran desde el panel `/suricata`.

El seed inicial en `backend/app/db/seed/suricata.py` crea, si hace falta:

- perfil base activo.
- fuentes externas compatibles con `suricata-update`.
- bloqueo/deteccion de YouTube y YouTube Music por TLS, HTTP y DNS.
- bloqueo/deteccion de sitios adultos por TLS, HTTP y DNS.
- bloqueo UDP/443 para reducir evasión por QUIC/HTTP3 en sitios adultos.

`suricata-update` genera el archivo runtime en el volumen `suricata-rules`. El YAML solo carga:

```yaml
rule-files:
  - suricata.rules
```

Para activar o desactivar una regla local, usar el checkbox de **Reglas personalizadas** en la interfaz y luego **Aplicar configuracion**.

## Gestion desde UI

La gestion operativa se divide en rutas bajo `/suricata`:

| Ruta | Funcion |
| ---- | ------- |
| `/suricata` | Resumen y estado del contenedor/perfil/job. |
| `/suricata/sources` | Activar o desactivar fuentes externas de `suricata-update`. |
| `/suricata/profiles` | Crear, activar o eliminar perfiles. |
| `/suricata/overrides` | Crear overrides por `GID:SID`. |
| `/suricata/custom-rules` | Crear, activar, desactivar o eliminar reglas locales. |
| `/suricata/notifications` | Configurar Telegram y destinatarios. |

Los cambios guardados en PostgreSQL no modifican Suricata hasta presionar **Aplicar configuracion**. El backend entonces renderiza `enable.conf`, `disable.conf`, `drop.conf`, `modify.conf` y `local-rules/custom.rules`, ejecuta `suricata-update`, valida con `suricata -T` y recarga el proceso con `USR2` si todo pasa.

## Notificaciones

Las reglas custom y overrides pueden marcarse con `notify_enabled`. Ese campo no cambia la regla ni el archivo generado; solo indica al backend que debe notificar eventos `alert` cuyo `GID:SID` coincida con el perfil activo.

La configuracion global de Telegram vive en `suricata_notification_settings` e incluye activacion global, destinatarios, buffer, minutos de agrupacion y zona horaria. El token del bot se configura fuera de la base de datos mediante `BACKEND_TELEGRAM_BOT_TOKEN`.

## Validacion rapida

Ver logs:

```bash
docker compose logs --tail=100 suricata
```

Generar trafico:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com
```

Confirmar que el flujo llega a Elasticsearch:

```bash
curl http://localhost:9200/_cat/indices?v
```

## Riesgos

- Requiere privilegios elevados.
- En modo IPS modifica reglas `iptables`/`ip6tables` en `OUTPUT` y `FORWARD` mientras el contenedor esta activo.
- En modo IDS depende de que `SURICATA_INTERFACE` exista en el host.
- No tiene healthcheck propio en Compose.

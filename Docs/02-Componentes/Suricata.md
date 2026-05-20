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
- `suricata/config/rules/suricata.rules`: reglas locales base.
- `suricata/config/rules/youtube-block.rules`: reglas de bloqueo/deteccion para YouTube.
- `suricata/config/rules/adult-block.rules`: reglas de bloqueo/deteccion para sitios adultos.

Compose ejecuta Suricata con:

- `network_mode: host`
- `privileged: true`
- capacidades `NET_ADMIN` y `NET_RAW`
- volumen `suricata-logs:/var/log/suricata`

## Modos de ejecucion

Modo IPS por defecto:

```env
SURICATA_MODE=ips
```

En IPS, el entrypoint agrega reglas `NFQUEUE` en `OUTPUT` para IPv4 e IPv6 y ejecuta Suricata con `-q 0`. Este modo permite que reglas `reject` o `drop` bloqueen trafico.

Modo IDS opcional:

```env
SURICATA_MODE=ids
SURICATA_INTERFACE=wlp0s20f3
```

En IDS, Suricata captura pasivamente desde una o varias interfaces separadas por coma:

```env
SURICATA_INTERFACE=wlp0s20f3,virbr0
```

## Reglas locales

Directorio: `suricata/config/rules/`

Reglas actuales:

- alerta ICMP para validar `ping`.
- bloqueo de `example.com` por TLS SNI.
- bloqueo de `example.com` por DNS.
- bloqueo de `example.com` por HTTP host.
- bloqueo/deteccion de YouTube y YouTube Music por TLS, HTTP y DNS.
- bloqueo/deteccion de sitios adultos por TLS, HTTP y DNS.

Los archivos cargados por `suricata/config/suricata.yaml` son:

```yaml
rule-files:
  - suricata.rules
  - youtube-block.rules
  - adult-block.rules
```

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
- En modo IPS modifica reglas `iptables`/`ip6tables` mientras el contenedor esta activo.
- En modo IDS depende de que `SURICATA_INTERFACE` exista en el host.
- No tiene healthcheck propio en Compose.

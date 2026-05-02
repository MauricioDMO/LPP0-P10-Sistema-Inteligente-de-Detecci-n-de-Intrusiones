# Filebeat

Filebeat es el agente que lee los eventos EVE JSON generados por Suricata y los envia a Logstash.

## Rol en el proyecto

- Lee `/var/log/suricata/eve.json` desde el volumen compartido `suricata-logs`.
- Usa el modulo oficial de Suricata para interpretar eventos.
- Envia eventos a Logstash por Beats en `logstash:5044`.
- Guarda offsets en `filebeat-data` para no reingerir todo tras reinicios.

## Configuracion real

Archivo: `filebeat/filebeat.yml`

```yaml
filebeat.config.modules:
  path: ${path.config}/modules.d/*.yml
  reload.enabled: false

output.logstash:
  hosts: ["logstash:5044"]

setup.kibana:
  host: "http://kibana:5601"
```

Modulo Suricata: `filebeat/modules.d/suricata.yml`

```yaml
- module: suricata
  eve:
    enabled: true
    var.paths: ["/var/log/suricata/eve.json"]
```

Compose ejecuta Filebeat como `root` y con `--strict.perms=false` para evitar problemas de permisos dentro del contenedor.

## Validacion rapida

Ver logs:

```bash
docker compose logs --tail=100 filebeat
```

Buscar conexion con Logstash:

```bash
docker logs filebeat | grep -i logstash
```

Setup de assets en Kibana, si se requiere:

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

## Riesgos

- Si `eve.json` no existe o no crece, Filebeat no enviara eventos.
- Si Logstash falla, Filebeat no puede entregar datos.
- `strict.perms=false` simplifica laboratorio, pero no es ideal para hardening.

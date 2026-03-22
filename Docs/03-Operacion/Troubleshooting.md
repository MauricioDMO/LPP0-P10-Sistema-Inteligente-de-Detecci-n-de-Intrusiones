# Troubleshooting

## 1) Docker daemon apagado

### Sintoma

Errores como:

```text
failed to connect to the docker API ... docker.sock ... no such file or directory
```

### Causa

Docker no esta iniciado o el socket configurado no existe.

### Solucion

1. Iniciar Docker Desktop o Docker Engine.
2. Verificar con:

```bash
docker info
```

## 2) Suricata no arranca por interfaz invalida

### Sintoma

Suricata falla al iniciar o no captura trafico.

### Causa

`SURICATA_INTERFACE` no coincide con interfaces reales del host, o el formato de lista por comas es invalido.

### Solucion

1. Listar interfaces:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

2. Ajustar `.env` con una o varias interfaces validas (separadas por coma):

```env
SURICATA_INTERFACE=wlp0s20f3
# o
SURICATA_INTERFACE=wlp0s20f3,zttqhrw6r3
```

En este host, las interfaces disponibles son `wlp0s20f3`, `zttqhrw6r3`, `zttqh2xyhk` y `virbr0`, asi que `eth0` no debe usarse salvo que exista en otro equipo.

3. Evitar comas extra al inicio/final y nombres inexistentes.
4. Reiniciar stack:

```bash
docker compose up -d --force-recreate suricata
```

## 3) Elasticsearch falla por parametros del kernel

### Sintoma

Elasticsearch no sube o se reinicia constantemente.

### Causa

`vm.max_map_count` bajo en Linux.

### Solucion

```bash
sudo sysctl -w vm.max_map_count=262144
```

Para persistir, agregar en `/etc/sysctl.conf` y aplicar `sudo sysctl -p`.

## 4) No aparecen eventos en Kibana

### Posibles causas

- Suricata no genera `eve.json`.
- Filebeat no puede leer el archivo.
- Filebeat setup no ejecutado.
- No hubo trafico durante la ventana de tiempo seleccionada.

### Verificaciones

```bash
docker compose logs -f suricata
docker compose logs -f filebeat
curl http://localhost:9200/_cat/indices?v
```

En Kibana, ampliar ventana temporal y filtrar por `event.module: suricata`.

## 5) Error de permisos en captura o logs

### Causa

Restricciones del host (AppArmor/SELinux/politicas locales) o cambios de permisos de volumen.

### Solucion

- Confirmar que Suricata corre con privilegios definidos en compose.
- Revisar auditorias del sistema si hay bloqueo por politicas.
- Verificar que `suricata-logs` este montado en ambos servicios.

## 6) Puertos 9200/5601 expuestos sin seguridad

### Riesgo

Acceso no autenticado a datos y UI.

### Mitigacion minima

- Restringir por firewall.
- Evitar exposicion publica.
- En produccion, activar autenticacion/TLS de Elastic.

## 7) Comandos de diagnostico rapido

```bash
docker compose ps
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 kibana
curl -s http://localhost:9200 | cat
```

## 8) Cuando escalar a hardening

Si el entorno deja de ser solo laboratorio, priorizar:

1. Seguridad de Elastic habilitada.
2. Segmentacion de red y control de acceso.
3. Politicas de backup de volumenes.
4. Monitoreo de recursos y alertas de salud.

# Suricata

## Que es

Suricata es un IDS/IPS y motor de Network Security Monitoring. Inspecciona trafico de red y genera eventos estructurados (EVE JSON) que luego pueden analizarse en plataformas como Elastic.

## Por que se usa en este proyecto

- Permite capturar y clasificar eventos de red en tiempo real.
- Genera salida JSON estandar para pipelines de observabilidad.
- Tiene ecosistema maduro de reglas y eventos por protocolo.

## Como esta configurado aqui

### Contenedor

- Imagen base: Debian 12 con paquete Suricata instalado.
- Arranque via `entrypoint.sh`.
- Ejecucion con `network_mode: host`, `privileged: true`, `NET_ADMIN` y `NET_RAW`.

### Interfaz de captura

En modo `ids`, se toma de la variable `SURICATA_INTERFACE` en `.env`.

Soporta una o varias interfaces separadas por coma.

Ejemplos:

- Una interfaz: `SURICATA_INTERFACE=wlp0s20f3`
- Varias interfaces: `SURICATA_INTERFACE=wlp0s20f3,zttqhrw6r3`
- En este host, las interfaces visibles son `wlp0s20f3`, `zttqhrw6r3`, `zttqh2xyhk` y `virbr0`.

Si vas a inspeccionar trafico real de la tarjeta Wi-Fi, `wlp0s20f3` debe ser la interfaz principal.

En modo `local-ips`, Suricata no usa `SURICATA_INTERFACE`; el contenedor engancha `NFQUEUE` en `OUTPUT` para que las reglas `drop` o `reject` bloqueen trafico generado por el host/VM.

En modo `gateway-ips`, el contenedor no modifica iptables. La VM Debian configura NAT y reglas `NFQUEUE` en `FORWARD`, y Suricata solo escucha la cola con `-q`.

El modo de ejecucion se controla con `SURICATA_MODE`:

- `SURICATA_MODE=ids` para captura pasiva en una o varias interfaces.
- `SURICATA_MODE=local-ips` para conservar el IPS local actual con `NFQUEUE` en `OUTPUT`.
- `SURICATA_MODE=gateway-ips` para gateway L3 con `NFQUEUE` en `FORWARD` configurado por scripts del host.

`SURICATA_MODE=ips` se acepta como alias heredado de `local-ips`.

En modo `ids`, el `entrypoint.sh` transforma ese valor en multiples flags de Suricata:

- `-i wlp0s20f3 -i zttqhrw6r3`

### Configuracion principal

Archivo: `suricata/config/suricata.yaml`

Puntos clave:

- `default-log-dir: /var/log/suricata/`
- `eve-log` habilitado con archivo `eve.json`
- tipos de eventos extendidos (alert, frame, anomaly, http y otros segun config)
- `default-rule-path: /var/lib/suricata/rules`
- `rule-files` incluye `suricata.rules`

### Regla local de validacion

Archivo: `suricata/config/rules/suricata.rules`

```text
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

Esta regla permite validar facilmente el flujo generando trafico ICMP.

## Flujo de datos que produce

1. Captura paquetes en la interfaz del host.
2. Aplica decodificacion y reglas.
3. Escribe eventos en `/var/log/suricata/eve.json`.
4. Filebeat lee ese archivo desde el volumen compartido.

## Buenas practicas

- Verificar interfaz antes de levantar (`ip -o link show`).
- Mantener reglas versionadas y con `sid` unicos.
- Separar reglas de laboratorio y reglas de produccion.
- Revisar crecimiento de `eve.json` y rotacion de logs.

## Riesgos y limitaciones

- Requiere privilegios altos en contenedor.
- Dependencia del host networking.
- Sin ajuste fino de rendimiento para trafico alto.
- Sin healthcheck propio en compose (se confia en restart policy).
- En modo gateway, si Suricata no esta escuchando la cola y las reglas `NFQUEUE` siguen activas, el trafico de clientes puede quedar bloqueado hasta ejecutar `suricata-gateway-cleanup` o `unmount.sh`.

# Levantamiento Gateway

Este modo prepara una VM Debian como gateway L3 para que clientes conectados a un AP pasen por Suricata antes de salir a la red externa.

## Arquitectura

```text
Red externa/universidad
  -> WAN_IF VM Debian
  -> NAT + DHCP + NFQUEUE FORWARD
  -> Suricata Docker network_mode host, -q 0
  -> LAN_IF VM Debian
  -> TP-Link en Access Point mode
  -> Clientes
```

## Diferencia con el modo normal

- `docker-compose.yml`: modo normal/local. Mantiene `ips`, que pone NFQUEUE en `OUTPUT` y `FORWARD` desde el contenedor.
- `docker-compose.prod.yml`: variante basica con puertos principales ligados a `127.0.0.1`; no es gateway.
- `docker-compose.gateway.yml`: compose standalone para gateway. Suricata usa `gateway-ips` y no modifica iptables desde el contenedor.

El modo normal se sigue levantando con el `.env` del proyecto y no usa las variables de MAC del gateway. El modo gateway usa `/etc/suricata-lab/gateway.env` para separar la configuracion de red fisica/VM.

## Archivos relevantes

- `gateway/scripts/gateway.env.example`: variables de interfaces, LAN, DHCP y NFQUEUE.
- `gateway/scripts/render-config.sh`: renderiza templates con variables reales.
- `gateway/scripts/install-symlinks.sh`: instala symlinks y configs renderizadas.
- `gateway/scripts/apply-gateway.sh`: aplica IP LAN, forwarding, NAT, bloqueos QUIC/DoT y NFQUEUE.
- `gateway/scripts/start-gateway.sh`: instala, aplica gateway y levanta Docker Compose.
- `gateway/scripts/cleanup-gateway.sh`: limpia reglas NAT/NFQUEUE.
- `gateway/scripts/unmount.sh`: baja compose y elimina symlinks/configs renderizadas.
- `gateway/templates/dnsmasq-lab.conf.tpl`: template DHCP.
- `gateway/sysctl-suricata-gateway.conf`: sysctl persistente.
- `/etc/systemd/system/suricata-gateway.service`: servicio instalado en la VM para reaplicar red gateway en cada arranque.
- `/usr/local/sbin/suricata-gateway-wait`: helper local que espera `LAN_IF` y `WAN_IF` antes de aplicar reglas.
- `gateway/vm/baseDeb-preseed.cfg`: preseed Debian base para la VM gateway.
- `gateway/vm/baseDeb-usb-nic-realtek.xml`: fragmento libvirt para pasar un adaptador USB Realtek RTL8153 a la VM.
- `gateway/vm/baseDeb-usb-nic-asix.xml`: fragmento libvirt para pasar un adaptador USB ASIX AX88179 a la VM.

## Levantar la VM KVM

Preparar host y servicios libvirt:

```bash
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system libvirt-clients virtinst virt-manager virt-xml
sudo systemctl enable --now libvirtd virtlogd virtlockd
sudo virsh --connect qemu:///system net-autostart default
sudo virsh --connect qemu:///system net-start default 2>/dev/null || true
```

Verificar KVM en el host:

```bash
ls -l /dev/kvm
lscpu | grep -i virtualization
```

Si `/dev/kvm` no existe pero el CPU muestra `VT-x` o `AMD-V`, cargar y persistir modulos:

```bash
sudo modprobe kvm
sudo modprobe kvm_intel
printf "kvm\nkvm_intel\n" | sudo tee /etc/modules-load.d/kvm.conf
```

Crear disco en el storage de libvirt y copiar ISO:

```bash
sudo mkdir -p /var/lib/libvirt/images/baseDeb
sudo qemu-img create -f qcow2 /var/lib/libvirt/images/baseDeb/baseDeb.qcow2 40G
sudo cp -n /home/mauriciodmo/core/iso/debian-13.4.0-amd64-netinst.iso /var/lib/libvirt/images/
sudo chown -R libvirt-qemu:libvirt-qemu /var/lib/libvirt/images/baseDeb
sudo chown libvirt-qemu:libvirt-qemu /var/lib/libvirt/images/debian-13.4.0-amd64-netinst.iso
```

Crear la VM con KVM y CPU real del host. `host-passthrough` evita errores como `CPU does not support x86-64-v2` al construir imagenes modernas:

```bash
virt-install \
  --connect qemu:///system \
  --virt-type kvm \
  --name baseDeb \
  --memory 4096 \
  --vcpus 2 \
  --cpu host-passthrough \
  --disk path="/var/lib/libvirt/images/baseDeb/baseDeb.qcow2",format=qcow2,bus=virtio \
  --cdrom "/var/lib/libvirt/images/debian-13.4.0-amd64-netinst.iso" \
  --os-variant debian12 \
  --network network=default,model=virtio \
  --graphics spice \
  --video virtio \
  --boot uefi \
  --noautoconsole
```

Abrir consola grafica para instalar Debian:

```bash
virt-manager --connect qemu:///system
```

Despues de instalar Debian, apagar y adjuntar las dos USB NIC:

```bash
virsh --connect qemu:///system shutdown baseDeb
virsh --connect qemu:///system attach-device baseDeb gateway/vm/baseDeb-usb-nic-realtek.xml --persistent
virsh --connect qemu:///system attach-device baseDeb gateway/vm/baseDeb-usb-nic-asix.xml --persistent
virsh --connect qemu:///system start baseDeb
```

Si una VM ya fue creada como `type=qemu` o CPU `qemu64`, corregirla asi:

```bash
virsh --connect qemu:///system shutdown baseDeb
virt-xml --connect qemu:///system baseDeb --edit --xml ./@type=kvm
virt-xml --connect qemu:///system baseDeb --edit --cpu host-passthrough
virsh --connect qemu:///system start baseDeb
```

Verificar dentro de la VM:

```bash
lscpu | grep -E "Model name|Hypervisor|Virtualization"
ip -br link
```

## Primer uso en la VM

Instalar dependencias del sistema. En Debian 12 suele existir `docker-compose-plugin`; en Debian 13/Trixie puede llamarse `docker-compose`:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool
sudo systemctl enable --now docker
```

Si `docker-compose-plugin` no existe:

```bash
sudo apt install -y git docker.io docker-compose dnsmasq iptables iproute2 curl ethtool
sudo systemctl enable --now docker
```

Instalar symlinks iniciales:

```bash
./gateway/scripts/install-symlinks.sh
```

Editar variables reales:

```bash
sudo nano /etc/suricata-lab/gateway.env
```

Valores minimos:

```env
INTERNAL_MAC="9c:69:d3:66:86:cc"
EXTERNAL_MAC="00:e0:4c:68:18:a3"
WAN_IF=""
LAN_IF=""
LAN_IP="192.168.50.1"
LAN_CIDR="192.168.50.1/24"
LAN_NET="192.168.50.0/24"
DHCP_START="192.168.50.50"
DHCP_END="192.168.50.200"
DHCP_LEASE="12h"
DNS_1="1.1.1.1"
DNS_2="8.8.8.8"
NFQUEUE_NUM="0"
BLOCK_QUIC="true"
BLOCK_DOT="true"
PROJECT_LINK_DIR="/opt/suricata-lab"
RENDER_DIR="/etc/suricata-lab/rendered"
```

`INTERNAL_MAC` identifica el lado LAN/router/AP. `EXTERNAL_MAC` identifica el lado ISP/red externa. Los scripts resuelven automaticamente `LAN_IF` y `WAN_IF` desde esas MACs, por lo que los nombres variables de adaptadores USB no rompen el arranque.

Si quieres forzar nombres de interfaz manualmente, define tambien:

```env
LAN_IF="enp1s0"
WAN_IF="enp2s0"
```

Si `LAN_IF`/`WAN_IF` estan vacios, se resuelven por MAC. Si tienen valor, se usan como override manual.

En la VM de laboratorio actual, las interfaces quedaron asi:

```text
LAN/router principal: enx9c69d36686cc  MAC 9c:69:d3:66:86:cc
USB WAN/ISP:          enx00e04c6818a3  MAC 00:e0:4c:68:18:a3
Gestion/libvirt NAT:  enp1s0           IP 192.168.122.68, default route actual
```

Para una prueba con salida a Internet por la red NAT de libvirt, usa `enp1s0` como WAN real:

```env
LAN_IF="enx9c69d36686cc"
WAN_IF="enp1s0"
```

Para una prueba con ISP/router conectado al USB externo, primero verifica que `enx00e04c6818a3` tenga IP y default route, y luego usa:

```env
LAN_IF="enx9c69d36686cc"
WAN_IF="enx00e04c6818a3"
```

La interfaz configurada como `WAN_IF` debe coincidir con la ruta real de salida (`ip route`). Si no coincide, NAT/NFQUEUE quedan aplicados sobre una interfaz por donde no pasa trafico.

## Estado auditado del servidor actual

El servidor revisado en la VM `suricata` quedo asi:

```text
Host: Debian 13, kernel 6.12
Gestion/WAN real actual: enp1s0, 192.168.122.68/24, default via 192.168.122.1
LAN hacia AP/router:     enx9c69d36686cc, 192.168.50.1/24
USB externa sin uso:     enx00e04c6818a3, sin IP ni trafico
Docker bridge:           172.18.0.1/16
Panel frontend:          http://192.168.122.68:3000
Backend API:             http://192.168.122.68:8000
```

El archivo real `/etc/suricata-lab/gateway.env` contiene:

```env
INTERNAL_MAC="9c:69:d3:66:86:cc"
EXTERNAL_MAC="00:e0:4c:68:18:a3"
LAN_IF="enx9c69d36686cc"
WAN_IF="enp1s0"
LAN_IP="192.168.50.1"
LAN_CIDR="192.168.50.1/24"
LAN_NET="192.168.50.0/24"
DHCP_START="192.168.50.50"
DHCP_END="192.168.50.200"
DHCP_LEASE="12h"
DNS_1="1.1.1.1"
DNS_2="8.8.8.8"
NFQUEUE_NUM="0"
PROJECT_LINK_DIR="/opt/suricata-lab"
RENDER_DIR="/etc/suricata-lab/rendered"
```

`dnsmasq` esta activo y usa `/etc/dnsmasq.d/suricata-lab.conf`, symlink a `/etc/suricata-lab/rendered/dnsmasq-lab.conf`. Ese archivo entrega DHCP en la LAN `192.168.50.0/24`, gateway `192.168.50.1` y DNS `1.1.1.1`, `8.8.8.8`.

Las reglas activas de firewall en el servidor son:

```text
LAN -> WAN udp/853  REJECT
LAN -> WAN tcp/853  REJECT
LAN -> WAN udp/443  REJECT
LAN -> WAN          NFQUEUE queue 0
WAN -> LAN          NFQUEUE queue 0
LAN -> WAN          MASQUERADE en POSTROUTING
```

Los rechazos de `udp/443`, `tcp/853` y `udp/853` reducen bypass por QUIC y DNS-over-TLS. El objetivo es que navegadores como Brave/Chrome caigan a trafico TLS/DNS inspeccionable por Suricata para que las reglas por dominio (`dns.query`, `tls.sni`, `http.host`) tengan mas probabilidad de aplicar.

El stack Docker auditado esta compuesto por:

```text
suricata      gateway-ips, NFQUEUE 0, network_mode host
filebeat      lee eve.json desde el volumen de logs de Suricata
logstash      recibe Filebeat y envia a Elasticsearch + Redis
elasticsearch almacenamiento historico
redis         pub/sub realtime canal suricata
backend       FastAPI, aplica reglas y expone API/WebSocket
postgres      usuarios, perfiles y reglas gestionadas
frontend      panel Next.js en puerto 3000
```

En PostgreSQL se observo el perfil activo `Test` en modo `IPS`. La entrada `pornhub.com` existe como lista negra de dominio, pero en el momento de auditoria estaba `enabled=false`, por lo que no aparecia como regla activa en `/var/lib/suricata/rules/suricata.rules`. Para probar bloqueo de ese dominio debe quedar habilitada y luego se debe ejecutar `Aplicar cambios` desde la UI o llamar al endpoint de apply.

Nota operacional: en el servidor habia cambios locales no commiteados para publicar backend/frontend por `GATEWAY_MANAGEMENT_IP`. Si se replica desde una rama sin esos commits, el panel puede volver a publicarse solo por `192.168.50.1`.

## KVM con bridge

Con KVM bridge la VM ve interfaces virtuales. En ese caso, las MACs que debe usar `gateway.env` son las MACs visibles dentro de la VM, no necesariamente las MACs fisicas de los adaptadores USB del host.

Recomendacion para que sea estable:

- Crea dos NICs en la VM, cada una conectada al bridge correspondiente.
- Fija una MAC estatica por NIC en virt-manager/libvirt.
- Dentro de la VM verifica con `ip link` que esas MACs aparecen en las interfaces.
- Coloca esas MACs en `INTERNAL_MAC` y `EXTERNAL_MAC`.

Si usas USB passthrough directo en vez de bridge, la VM normalmente vera las MACs fisicas de los adaptadores USB y puedes usar esas MACs directamente.

Levantar todo:

```bash
sudo /usr/local/sbin/suricata-gateway-start
```

El script hace tres cosas: instala/actualiza symlinks, aplica red (`LAN_IP`, forwarding, NAT, NFQUEUE y `dnsmasq`) y levanta `docker-compose.gateway.yml`. Los puertos de gestion se publican en `GATEWAY_MANAGEMENT_IP`; si no se define, se calcula desde la IP usada por la ruta default de la VM.

## Persistencia al reiniciar

El stack Docker usa `restart: unless-stopped`, por lo que los contenedores vuelven a subir solos despues de reiniciar la VM. Eso no restaura por si solo la configuracion del gateway L3: IP de LAN, NAT, reglas `FORWARD` hacia NFQUEUE y reinicio de `dnsmasq`.

Para evitar que el gateway quede parcialmente levantado despues de un reboot, la VM actual tiene instalado este servicio:

```text
/etc/systemd/system/suricata-gateway.service
```

Contenido esperado:

```ini
[Unit]
Description=Suricata lab gateway network setup
Documentation=file:/opt/suricata-lab/gateway/scripts/apply-gateway.sh
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/usr/local/sbin/suricata-gateway-wait
ExecStart=/usr/local/sbin/suricata-gateway-apply

[Install]
WantedBy=multi-user.target
```

El helper `/usr/local/sbin/suricata-gateway-wait` carga `/etc/suricata-lab/gateway.env` y espera hasta 30 segundos a que existan las interfaces configuradas como `LAN_IF` y `WAN_IF`. Esto evita que `dnsmasq` falle con `unknown interface` cuando systemd arranca servicios antes de que las NIC USB esten listas.

Contenido esperado del helper:

```bash
#!/usr/bin/env bash
set -euo pipefail
source /etc/suricata-lab/gateway.env

for _ in {1..30}; do
  if [[ -d "/sys/class/net/${LAN_IF}" && -d "/sys/class/net/${WAN_IF}" ]]; then
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for LAN_IF=${LAN_IF} WAN_IF=${WAN_IF}" >&2
exit 1
```

Activar o reparar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable suricata-gateway.service
sudo systemctl restart suricata-gateway.service
```

Verificar estado:

```bash
systemctl is-enabled suricata-gateway.service
systemctl is-active suricata-gateway.service dnsmasq docker
ip -br addr show dev enx9c69d36686cc
cat /proc/sys/net/ipv4/ip_forward
sudo iptables -S FORWARD
sudo iptables -t nat -S POSTROUTING
```

Estado esperado despues de reiniciar la VM actual:

```text
suricata-gateway.service: enabled, active
dnsmasq: active
docker: active
enx9c69d36686cc: UP 192.168.50.1/24
net.ipv4.ip_forward: 1
FORWARD: NFQUEUE queue 0 entre enx9c69d36686cc y enp1s0
POSTROUTING: MASQUERADE para 192.168.50.0/24 saliendo por enp1s0
```

Falla tipica antes de instalar este servicio:

```text
dnsmasq: unknown interface enx9c69d36686cc
```

Ese error indica que `dnsmasq` intento iniciar antes de que la interfaz LAN estuviera levantada o configurada. La solucion es ejecutar `sudo /usr/local/sbin/suricata-gateway-apply` para recuperar el estado en caliente y dejar habilitado `suricata-gateway.service` para los siguientes reinicios.

En la configuracion auditada, `GATEWAY_MANAGEMENT_IP` no estaba escrito en `gateway.env`; `start-gateway.sh` lo calcula con la IP fuente de la ruta default. Si quieres fijarlo explicitamente:

```env
GATEWAY_MANAGEMENT_IP="192.168.122.68"
```

`docker-compose.gateway.yml` incluye PostgreSQL interno para el backend. Si el backend reinicia con errores hacia `127.0.0.1:5432`, revisa que la version local tenga el servicio `postgres` y que `BACKEND_DATABASE_URL` apunte a `postgres:5432`.

El compose gateway usa el volumen Docker `suricata-rules` para `/var/lib/suricata/rules`, de forma que Suricata tenga un ruleset writable y el backend pueda aplicar politicas con `suricata-update`. Si el volumen esta vacio, el entrypoint crea una regla bootstrap ICMP para evitar arrancar sin reglas; despues la UI/backend puede reemplazar el ruleset.

## Reinicio y cambios

Las variables persistentes del gateway van en:

```text
/etc/suricata-lab/gateway.env
```

Despues de cambiar interfaces, LAN, DHCP, DNS o `NFQUEUE_NUM`, vuelve a renderizar/aplicar y reinicia el stack:

```bash
cd ~/proyecto-suricata
sudo /usr/local/sbin/suricata-gateway-start
```

Si solo cambiaste red gateway y no necesitas reconstruir contenedores, puedes aplicar y refrescar el servicio persistente:

```bash
sudo /usr/local/sbin/suricata-gateway-apply
sudo systemctl restart suricata-gateway.service
```

Para reiniciar solo Docker Compose, sin tocar reglas de red:

```bash
cd ~/proyecto-suricata
source /etc/suricata-lab/gateway.env
export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export GATEWAY_MANAGEMENT_IP="${GATEWAY_MANAGEMENT_IP:-$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)}"
export GATEWAY_MANAGEMENT_IP="${GATEWAY_MANAGEMENT_IP:-0.0.0.0}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${GATEWAY_MANAGEMENT_IP}:8000}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://${GATEWAY_MANAGEMENT_IP}:8000/ws}"
docker compose -f docker-compose.gateway.yml restart
```

Para bajar y levantar de nuevo los contenedores:

```bash
cd ~/proyecto-suricata
docker compose -f docker-compose.gateway.yml down
sudo /usr/local/sbin/suricata-gateway-start
```

## Actualizacion

Actualizar codigo desde la rama `gateway`:

```bash
cd ~/proyecto-suricata
git fetch origin gateway
git checkout gateway
git pull --ff-only origin gateway
sudo /usr/local/sbin/suricata-gateway-start
```

Si solo quieres reconstruir contenedores despues de actualizar, sin reaplicar red:

```bash
cd ~/proyecto-suricata
source /etc/suricata-lab/gateway.env
export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export GATEWAY_MANAGEMENT_IP="${GATEWAY_MANAGEMENT_IP:-$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)}"
export GATEWAY_MANAGEMENT_IP="${GATEWAY_MANAGEMENT_IP:-0.0.0.0}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${GATEWAY_MANAGEMENT_IP}:8000}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://${GATEWAY_MANAGEMENT_IP}:8000/ws}"
docker compose -f docker-compose.gateway.yml up -d --build
```

## Nota CPU/KVM

Si `virt-install` mostro `KVM acceleration not available`, la VM corre por emulacion QEMU. En ese modo algunos contenedores modernos pueden fallar durante build con:

```text
Fatal glibc error: CPU does not support x86-64-v2
```

Solucion recomendada: activar Intel VT-x/AMD-V en BIOS/UEFI, verificar que exista `/dev/kvm` en el host, y asegurar que la VM use `type=kvm` con CPU `host-passthrough`. Verificacion en el host:

```bash
ls -l /dev/kvm
virsh --connect qemu:///system dumpxml baseDeb | grep -E "<domain|<cpu|host-passthrough"
```

Mientras no haya KVM o la VM siga con CPU `qemu64`, el gateway puede tener las interfaces configuradas, pero el stack Docker puede fallar al construir imagenes que requieren CPU `x86-64-v2`.

## Verificacion

En la VM:

```bash
ip link
ip route
iptables -vnL FORWARD
iptables -t nat -vnL POSTROUTING
systemctl status dnsmasq
docker compose -f docker-compose.gateway.yml ps
docker compose -f docker-compose.gateway.yml logs -f suricata
```

Verificacion especifica del estado replicado:

```bash
systemctl is-enabled suricata-gateway.service
systemctl is-active suricata-gateway.service dnsmasq docker
cat /proc/sys/net/ipv4/ip_forward
cat /proc/sys/net/ipv6/conf/all/disable_ipv6
iptables -S FORWARD
iptables -t nat -S POSTROUTING
systemctl is-active dnsmasq
docker inspect suricata --format '{{range .Config.Env}}{{println .}}{{end}}' | grep SURICATA
docker exec postgres psql -U suricata -d suricata -c "select name,mode,is_active from suricata_profiles order by name;"
docker exec postgres psql -U suricata -d suricata -c "select list_type,entry_type,value,direction,action,enabled from suricata_list_entries order by created_at;"
```

Desde un cliente conectado al AP:

```bash
ping 192.168.50.1
curl http://neverssl.com
```

Servicios disponibles por la IP de gestion de la VM:

```text
Frontend: http://192.168.122.68:3000
Backend:  http://192.168.122.68:8000
```

La LAN del gateway sigue siendo `192.168.50.1/24` para clientes conectados al AP/router, pero el panel se publica por la IP de gestion para administrarlo sin conectarse a la red interna.

## Configuracion de VM

- `gateway/vm/baseDeb-preseed.cfg` instala una Debian base con usuario `debian`, SSH, sudo y `qemu-guest-agent`.
- Si la VM ya tiene dos NICs durante la instalacion, `netcfg/choose_interface auto` puede elegir cualquiera. Para una instalacion reproducible, instala con una sola NIC WAN y adjunta la USB Realtek despues, o fija la interfaz en el preseed.
- Despues del primer arranque instala dependencias gateway con `sudo apt install -y git docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool` o, en Debian 13, `sudo apt install -y git docker.io docker-compose dnsmasq iptables iproute2 curl ethtool`.
- `gateway/vm/baseDeb-usb-nic-realtek.xml` sirve para adjuntar por USB passthrough un NIC Realtek `0x0bda:0x8153`.
- `gateway/vm/baseDeb-usb-nic-asix.xml` sirve para adjuntar por USB passthrough un NIC ASIX `0x0b95:0x1790`.
- Si hay mas de un adaptador USB con el mismo vendor/product, fija tambien bus/device desde libvirt para evitar adjuntar el incorrecto.

## Limpieza

Limpiar solo reglas NAT/NFQUEUE:

```bash
sudo /usr/local/sbin/suricata-gateway-cleanup
```

Desmontar todo lo instalado por los scripts:

```bash
sudo /usr/local/sbin/suricata-gateway-unmount
```

`unmount.sh` elimina symlinks, archivos renderizados y reglas del gateway. No borra archivos versionados del repositorio.

## Automatizacion actual y pendiente

Automatizacion ya disponible:

- Resolucion de interfaces por MAC (`resolve-interfaces.sh`).
- Render de `dnsmasq` desde `/etc/suricata-lab/gateway.env`.
- Instalacion de symlinks en `/usr/local/sbin`.
- Aplicacion de IP LAN, forwarding, NAT, NFQUEUE y bloqueos QUIC/DoT.
- Levantamiento del stack gateway con `docker-compose.gateway.yml`.
- Reaplicacion de red gateway al arrancar mediante `suricata-gateway.service`.
- Espera de interfaces LAN/WAN antes de aplicar reglas mediante `suricata-gateway-wait`.

Automatizaciones recomendadas para hacerlo mas reproducible:

- Crear un script unico `bootstrap-gateway.sh` que instale paquetes (`docker.io`, compose, `dnsmasq`, `iptables`, `iproute2`, `ethtool`), copie `gateway.env.example` y ejecute `install-symlinks.sh`.
- Versionar una plantilla del servicio systemd para no depender de crearlo manualmente en la VM.
- Persistir `BLOCK_QUIC`, `BLOCK_DOT` y `GATEWAY_MANAGEMENT_IP` en `/etc/suricata-lab/gateway.env` para que no dependan de defaults ni de reglas runtime manuales.
- Generar un reporte automatico `suricata-gateway-doctor` que valide interfaces, ruta default, `ip_forward`, `dnsmasq`, reglas `NFQUEUE`, puertos del panel y estado Docker.
- Automatizar la creacion de perfiles/reglas iniciales por API o seed para no depender de configurar listas negras manualmente desde la UI.
- Usar reservas DHCP o AP en modo bridge para evitar doble NAT y ver clientes reales en vez de ver todo como la IP WAN del router/AP.
- Añadir una tarea que detecte jobs `running` antiguos en `suricata_apply_jobs` y los marque como fallidos o permita reintento seguro.

La automatizacion mas valiosa pendiente es un comando `doctor`, porque el servicio systemd ya evita que un reinicio deje el gateway sin NAT/NFQUEUE, pero aun falta una verificacion resumida de salud.

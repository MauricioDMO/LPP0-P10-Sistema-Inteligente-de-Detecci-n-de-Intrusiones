# Rendered by scripts/gateway/render-config.sh.
interface={{LAN_IF}}
bind-interfaces

dhcp-range={{DHCP_START}},{{DHCP_END}},{{DHCP_LEASE}}
dhcp-option=3,{{LAN_IP}}
dhcp-option=6,{{DNS_1}},{{DNS_2}}

domain=lab.local
local=/lab.local/

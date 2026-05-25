export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export const SURICATA_APPLY_WS_URL = process.env.NEXT_PUBLIC_SURICATA_APPLY_WS_URL ?? WS_URL.replace(/\/ws$/, "/ws/suricata/apply");

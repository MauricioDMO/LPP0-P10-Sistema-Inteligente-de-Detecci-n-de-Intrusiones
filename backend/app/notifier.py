import asyncio
import logging
import os
import time
from typing import Dict

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("BACKEND_TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("BACKEND_TELEGRAM_CHAT_ID", "")

_last_sent: Dict[str, float] = {}
_COOLDOWN_SECONDS = 30


def _is_alert_adult(event: dict) -> bool:
    sig = (event.get("alert") or event.get("suricata", {}).get("eve", {}).get("alert") or {}).get("signature") or ""
    return "bloqueo" in sig.lower()


def _should_notify(event: dict) -> bool:
    event_type = event.get("event_type") or event.get("suricata", {}).get("eve", {}).get("event_type") or ""
    if event_type != "alert":
        return False

    is_adult = _is_alert_adult(event)

    threat = event.get("_threat")
    is_malicious = threat and threat.get("is_malicious", False)

    return is_adult or is_malicious


def _get_dedup_key(event: dict) -> str:
    sig = (event.get("alert") or event.get("suricata", {}).get("eve", {}).get("alert") or {}).get("signature") or ""
    src = event.get("src_ip") or event.get("source", {}).get("ip") or ""
    return f"{sig}:{src}"


async def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured - missing token or chat ID")
        return
    try:
        import aiohttp
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Telegram send failed (%d): %s", resp.status, body)
    except Exception as e:
        logger.warning("Telegram send error: %s", e)


def _format_message(event: dict) -> str:
    sig = (event.get("alert") or event.get("suricata", {}).get("eve", {}).get("alert") or {}).get("signature") or "Alerta"
    src = event.get("src_ip") or event.get("source", {}).get("ip") or "?"
    dst = event.get("dest_ip") or event.get("destination", {}).get("ip") or "?"
    domain = ""
    dns = event.get("suricata", {}).get("eve", {}).get("dns", {})
    if dns:
        q = dns.get("queries") or []
        if q:
            domain = q[0].get("rrname", "")
    tls = event.get("suricata", {}).get("eve", {}).get("tls", {})
    if tls and tls.get("sni"):
        domain = tls["sni"]
    http = event.get("suricata", {}).get("eve", {}).get("http", {})
    if http and http.get("hostname"):
        domain = http["hostname"]

    ts = event.get("timestamp") or event.get("@timestamp") or ""
    if ts:
        try:
            from datetime import datetime
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%H:%M:%S")
        except Exception:
            pass

    icon = "🚫"
    if "bloqueo" in sig.lower():
        if "adult" in sig.lower() or any(d in sig.lower() for d in ["pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn", "tube8", "spankwire", "keezmovies", "motherless"]):
            icon = "🔞"
        else:
            icon = "🚫"

    threat = event.get("_threat")
    threat_line = ""
    if threat and threat.get("is_malicious"):
        threat_line = f"\n☠️ *Threat Intel:* Confianza {threat.get('confidence', 0)}% | {threat.get('total_reports', 0)} reportes"

    lines = [
        f"{icon} *{sig}*",
        f"🕐 {ts}" if ts else "",
        f"📌 Dominio: `{domain}`" if domain else "",
        f"🔹 Origen: `{src}`",
        f"🔸 Destino: `{dst}`",
    ]
    if threat_line:
        lines.append(threat_line)

    return "\n".join(line for line in lines if line)


async def process_event(event: dict):
    if not _should_notify(event):
        return

    key = _get_dedup_key(event)
    now = time.time()
    last = _last_sent.get(key, 0)
    if now - last < _COOLDOWN_SECONDS:
        return

    _last_sent[key] = now
    message = _format_message(event)
    await send_telegram(message)

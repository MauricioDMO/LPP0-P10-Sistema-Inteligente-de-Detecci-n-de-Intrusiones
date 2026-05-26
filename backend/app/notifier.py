import asyncio
import html
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy import select

from .db import AsyncSessionLocal
from .models.suricata import SuricataCustomRule, SuricataNotificationSettings, SuricataProfile, SuricataRuleOverride

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("BACKEND_TELEGRAM_BOT_TOKEN", "")

_last_sent: Dict[str, float] = {}
_COOLDOWN_SECONDS = 30
_buffered_events: list[dict] = []
_buffer_task: asyncio.Task | None = None


def _eve(event: dict) -> dict:
    return event.get("suricata", {}).get("eve", event)


def _alert(event: dict) -> dict:
    return _eve(event).get("alert") or event.get("alert") or {}


def _event_type(event: dict) -> str:
    return _eve(event).get("event_type") or event.get("event_type") or ""


def _ip(event: dict, key: str) -> str:
    eve = _eve(event)
    nested_key = "source" if key == "src_ip" else "destination"
    return eve.get(key) or eve.get(nested_key, {}).get("ip") or event.get(key) or event.get(nested_key, {}).get("ip") or "?"


def _event_rule_id(event: dict) -> tuple[int, int] | None:
    alert = _alert(event)
    sid = alert.get("signature_id") or alert.get("sid")
    if sid is None:
        return None
    gid = alert.get("gid") or alert.get("generator_id") or 1
    try:
        return int(gid), int(sid)
    except (TypeError, ValueError):
        return None


def _rule_text_id(rule_text: str) -> tuple[int, int] | None:
    sid_match = re.search(r"\bsid\s*:\s*(\d+)\s*;", rule_text)
    if sid_match is None:
        return None
    gid_match = re.search(r"\bgid\s*:\s*(\d+)\s*;", rule_text)
    return int(gid_match.group(1)) if gid_match else 1, int(sid_match.group(1))


async def _notification_settings(session) -> SuricataNotificationSettings | None:
    result = await session.execute(select(SuricataNotificationSettings).order_by(SuricataNotificationSettings.created_at).limit(1))
    return result.scalar_one_or_none()


async def _should_notify(event: dict) -> tuple[bool, SuricataNotificationSettings | None]:
    if _event_type(event) != "alert":
        return False, None
    rule_id = _event_rule_id(event)
    if rule_id is None:
        return False, None

    gid, sid = rule_id
    async with AsyncSessionLocal() as session:
        settings = await _notification_settings(session)
        if settings is None or not settings.telegram_enabled or not settings.telegram_chat_recipients:
            return False, settings

        profile_result = await session.execute(select(SuricataProfile).where(SuricataProfile.is_active.is_(True)).limit(1))
        profile = profile_result.scalar_one_or_none()
        if profile is None:
            return False, settings

        override_result = await session.execute(
            select(SuricataRuleOverride).where(
                SuricataRuleOverride.profile_id == profile.id,
                SuricataRuleOverride.gid == gid,
                SuricataRuleOverride.sid == sid,
                SuricataRuleOverride.enabled.is_(True),
                SuricataRuleOverride.notify_enabled.is_(True),
            )
        )
        if override_result.scalar_one_or_none() is not None:
            return True, settings

        rules_result = await session.execute(
            select(SuricataCustomRule).where(
                SuricataCustomRule.profile_id == profile.id,
                SuricataCustomRule.enabled.is_(True),
                SuricataCustomRule.notify_enabled.is_(True),
                SuricataCustomRule.validation_status == "valid",
            )
        )
        for rule in rules_result.scalars().all():
            if _rule_text_id(rule.rule_text) == rule_id:
                return True, settings

    return False, settings


def _get_dedup_key(event: dict) -> str:
    sig = _alert(event).get("signature") or ""
    src = _ip(event, "src_ip")
    return f"{sig}:{src}"


def _html(value: object) -> str:
    return html.escape(str(value), quote=False)


def _code(value: object) -> str:
    return f"<code>{_html(value)}</code>"


async def send_telegram(message: str, chat_id: str):
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram not configured - missing bot token")
        return
    try:
        import aiohttp
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Telegram send failed (%d): %s", resp.status, body)
    except Exception as e:
        logger.warning("Telegram send error: %s", e)


def _tzinfo(timezone_value: str) -> timezone:
    if timezone_value == "UTC":
        return timezone.utc
    match = re.fullmatch(r"UTC([+-])(\d{1,2})(?::?(\d{2}))?", timezone_value.strip())
    if match is None:
        return timezone.utc
    sign = 1 if match.group(1) == "+" else -1
    hours = int(match.group(2))
    minutes = int(match.group(3) or 0)
    return timezone(sign * timedelta(hours=hours, minutes=minutes))


def _format_event_time(event: dict, timezone_value: str) -> str:
    ts = event.get("timestamp") or event.get("@timestamp") or ""
    if not ts:
        return ""
    try:
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return parsed.astimezone(_tzinfo(timezone_value)).strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        return ts


def _format_message(event: dict, timezone_value: str = "UTC") -> str:
    sig = _alert(event).get("signature") or "Alerta"
    src = _ip(event, "src_ip")
    dst = _ip(event, "dest_ip")
    domain = ""
    eve = _eve(event)
    dns = eve.get("dns", {})
    if dns:
        q = dns.get("queries") or []
        if q:
            domain = q[0].get("rrname", "")
    tls = eve.get("tls", {})
    if tls and tls.get("sni"):
        domain = tls["sni"]
    http = eve.get("http", {})
    if http and http.get("hostname"):
        domain = http["hostname"]

    ts = _format_event_time(event, timezone_value)

    icon = "🚫"
    if "bloqueo" in sig.lower():
        if "adult" in sig.lower() or any(d in sig.lower() for d in ["pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn", "tube8", "spankwire", "keezmovies", "motherless"]):
            icon = "🔞"
        else:
            icon = "🚫"

    threat = event.get("_threat")
    threat_line = ""
    if threat and threat.get("is_malicious"):
        threat_line = f"\n☠️ <b>Threat Intel:</b> Confianza {_html(threat.get('confidence', 0))}% | {_html(threat.get('total_reports', 0))} reportes"

    lines = [
        f"{icon} <b>{_html(sig)}</b>",
        f"🕐 {_html(ts)}" if ts else "",
        f"📌 Dominio: {_code(domain)}" if domain else "",
        f"🔹 Origen: {_code(src)}",
        f"🔸 Destino: {_code(dst)}",
    ]
    if threat_line:
        lines.append(threat_line)

    return "\n".join(line for line in lines if line)


def _format_buffer_message(events: list[dict], timezone_value: str) -> str:
    lines = [f"<b>Resumen Suricata:</b> {len(events)} alertas"]
    for event in events[:20]:
        sig = _alert(event).get("signature") or "Alerta"
        src = _ip(event, "src_ip")
        dst = _ip(event, "dest_ip")
        ts = _format_event_time(event, timezone_value)
        lines.append(f"- {_code(ts)} {_html(sig)} | {_code(src)} -> {_code(dst)}")
    if len(events) > 20:
        lines.append(f"... y {len(events) - 20} alertas mas")
    return "\n".join(lines)


async def _send_to_recipients(message: str, settings: SuricataNotificationSettings) -> None:
    for recipient in settings.telegram_chat_recipients:
        chat_id = str(recipient.get("chat_id", "")).strip()
        if chat_id:
            await send_telegram(message, chat_id)


async def _flush_buffer(settings: SuricataNotificationSettings) -> None:
    global _buffer_task
    await asyncio.sleep(settings.buffer_minutes * 60)
    events = list(_buffered_events)
    _buffered_events.clear()
    _buffer_task = None
    if events:
        await _send_to_recipients(_format_buffer_message(events, settings.timezone), settings)


async def process_event(event: dict):
    should_notify, settings = await _should_notify(event)
    if not should_notify or settings is None:
        return

    key = _get_dedup_key(event)
    now = time.time()
    last = _last_sent.get(key, 0)
    if now - last < _COOLDOWN_SECONDS:
        return

    _last_sent[key] = now
    if settings.buffer_enabled:
        global _buffer_task
        _buffered_events.append(event)
        if _buffer_task is None or _buffer_task.done():
            _buffer_task = asyncio.create_task(_flush_buffer(settings))
        return

    message = _format_message(event, settings.timezone)
    await _send_to_recipients(message, settings)

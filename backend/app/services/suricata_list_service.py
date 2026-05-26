"""Convert managed block/allow list entries into Suricata custom rules."""

import ipaddress
import re
import uuid
from typing import Any
from urllib.parse import urlparse

from .suricata_config_renderer import validate_custom_rule_text

LIST_RULE_SID_BASE = 1_500_000
DOMAIN_RE = re.compile(r"^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$")


def normalize_list_value(entry_type: str, value: str) -> str:
    normalized = value.strip()
    if entry_type == "domain":
        parsed = urlparse(normalized if "://" in normalized else f"//{normalized}")
        host = (parsed.hostname or normalized).strip().lower().rstrip(".")
        if not DOMAIN_RE.match(host):
            raise ValueError("Dominio invalido")
        return host
    if entry_type == "ip":
        try:
            return str(ipaddress.ip_address(normalized))
        except ValueError as exc:
            raise ValueError("IP invalida") from exc
    if entry_type == "cidr":
        try:
            return str(ipaddress.ip_network(normalized, strict=False))
        except ValueError as exc:
            raise ValueError("CIDR invalido") from exc
    raise ValueError("Tipo de entrada invalido")


def validate_list_entry(list_type: str, entry_type: str, value: str, direction: str, action: str) -> str:
    normalized = normalize_list_value(entry_type, value)
    if direction not in {"source", "destination", "both"}:
        raise ValueError("Direccion invalida")
    if list_type == "allow" and action != "pass":
        raise ValueError("Las listas blancas usan accion pass")
    if list_type == "block" and action not in {"drop", "reject"}:
        raise ValueError("Las listas negras usan accion drop o reject")
    return normalized


def escape_rule_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def domain_rules(entry: Any, first_sid: int) -> list[str]:
    action = entry.action
    value = escape_rule_value(entry.value)
    label = f"SURICATA-LIST {entry.list_type} domain {entry.value}"
    return [
        f'{action} dns any any -> any any (msg:"{label} DNS"; dns.query; content:"{value}"; nocase; endswith; sid:{first_sid}; rev:1;)',
        f'{action} tls any any -> any any (msg:"{label} TLS"; tls.sni; content:"{value}"; nocase; endswith; sid:{first_sid + 1}; rev:1;)',
        f'{action} http any any -> any any (msg:"{label} HTTP"; http.host; content:"{value}"; endswith; sid:{first_sid + 2}; rev:1;)',
    ]


def ip_rules(entry: Any, first_sid: int) -> list[str]:
    directions = [entry.direction] if entry.direction != "both" else ["destination", "source"]
    rules: list[str] = []
    for index, direction in enumerate(directions):
        src = entry.value if direction == "source" else "any"
        dst = entry.value if direction == "destination" else "any"
        label = f"SURICATA-LIST {entry.list_type} {direction} {entry.value}"
        rules.append(f'{entry.action} ip {src} any -> {dst} any (msg:"{label}"; sid:{first_sid + index}; rev:1;)')
    return rules


def generated_rules_for_entry(entry: Any, first_sid: int) -> list[str]:
    if not entry.enabled:
        return []
    if entry.entry_type == "domain":
        return domain_rules(entry, first_sid)
    return ip_rules(entry, first_sid)


def preview_generated_rules(entries: list[Any]) -> list[tuple[uuid.UUID, str]]:
    rules: list[tuple[uuid.UUID, str]] = []
    sid = LIST_RULE_SID_BASE
    for entry in sorted(entries, key=lambda item: (item.created_at, str(item.id))):
        entry_rules = generated_rules_for_entry(entry, sid)
        rules.extend((entry.id, rule) for rule in entry_rules)
        sid += max(len(entry_rules), 1)
    return rules


async def sync_profile_list_rules(session: Any, profile_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
    from sqlalchemy import delete, select

    from ..models.suricata import SuricataCustomRule, SuricataListEntry

    result = await session.execute(
        select(SuricataListEntry).where(SuricataListEntry.profile_id == profile_id).order_by(SuricataListEntry.created_at, SuricataListEntry.id)
    )
    entries = list(result.scalars().all())
    stale_rule_ids = [uuid.UUID(rule_id) for entry in entries for rule_id in entry.generated_rule_ids]
    if stale_rule_ids:
        await session.execute(delete(SuricataCustomRule).where(SuricataCustomRule.id.in_(stale_rule_ids)))

    generated = preview_generated_rules(entries)
    grouped: dict[uuid.UUID, list[SuricataCustomRule]] = {entry.id: [] for entry in entries}
    for entry_id, rule_text in generated:
        status, error = validate_custom_rule_text(rule_text)
        rule = SuricataCustomRule(
            id=uuid.uuid4(),
            profile_id=profile_id,
            name=f"[Listas] {entry_id}",
            description="Regla generada automaticamente desde listas negras/blancas",
            rule_text=rule_text,
            enabled=True,
            notify_enabled=entry.notify_enabled,
            validation_status=status,
            validation_error=error,
        )
        session.add(rule)
        grouped.setdefault(entry_id, []).append(rule)

    for entry in entries:
        entry.generated_rule_ids = [str(rule.id) for rule in grouped.get(entry.id, [])]
    await session.flush()
    return generated

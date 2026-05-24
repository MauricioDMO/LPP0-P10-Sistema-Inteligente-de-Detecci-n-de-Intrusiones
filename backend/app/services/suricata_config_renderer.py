"""Render Suricata policy rows into controlled config files."""

from dataclasses import dataclass

from ..models.suricata import SuricataCustomRule, SuricataRuleOverride


@dataclass(frozen=True)
class RenderedSuricataConfig:
    enable_conf: str
    disable_conf: str
    drop_conf: str
    modify_conf: str
    local_rules: str

    def as_dict(self) -> dict[str, str]:
        return {
            "enable.conf": self.enable_conf,
            "disable.conf": self.disable_conf,
            "drop.conf": self.drop_conf,
            "modify.conf": self.modify_conf,
            "local-rules/custom.rules": self.local_rules,
        }


def sid_line(override: SuricataRuleOverride) -> str:
    return f"{override.gid}:{override.sid}"


def render_suricata_config(
    overrides: list[SuricataRuleOverride], custom_rules: list[SuricataCustomRule]
) -> RenderedSuricataConfig:
    enabled_overrides = [override for override in overrides if override.enabled]
    enable_lines = sorted(sid_line(override) for override in enabled_overrides if override.action == "enable")
    disable_lines = sorted(sid_line(override) for override in enabled_overrides if override.action == "disable")
    drop_lines = sorted(sid_line(override) for override in enabled_overrides if override.action in {"drop", "reject"})
    local_rule_lines = [rule.rule_text.strip() for rule in custom_rules if rule.enabled and rule.validation_status == "valid"]

    return RenderedSuricataConfig(
        enable_conf="\n".join(enable_lines) + ("\n" if enable_lines else ""),
        disable_conf="\n".join(disable_lines) + ("\n" if disable_lines else ""),
        drop_conf="\n".join(drop_lines) + ("\n" if drop_lines else ""),
        modify_conf="",
        local_rules="\n".join(local_rule_lines) + ("\n" if local_rule_lines else ""),
    )


def validate_custom_rule_text(rule_text: str) -> tuple[str, str | None]:
    stripped = rule_text.strip()
    if not stripped.endswith(")") and not stripped.endswith(";)"):
        return "invalid", "La regla debe terminar con ')' o ';)'."
    if "(" not in stripped or ")" not in stripped:
        return "invalid", "La regla debe incluir opciones entre parentesis."
    if "sid:" not in stripped:
        return "invalid", "La regla debe incluir sid:."
    if "rev:" not in stripped:
        return "invalid", "La regla debe incluir rev:."
    if "msg:" not in stripped:
        return "invalid", "La regla debe incluir msg:."
    if not stripped.split(None, 1)[0] in {"alert", "drop", "reject", "pass"}:
        return "invalid", "La accion debe ser alert, drop, reject o pass."
    if " -> " not in stripped and " <> " not in stripped:
        return "invalid", "La regla debe incluir direccion -> o <>."
    return "valid", None

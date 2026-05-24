"""Apply Suricata desired policy through the Docker socket."""

import asyncio
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.suricata import (
    SuricataApplyJob,
    SuricataConfigVersion,
    SuricataCustomRule,
    SuricataProfile,
    SuricataRuleOverride,
    SuricataSource,
)
from .suricata_config_renderer import RenderedSuricataConfig, render_suricata_config


class SuricataCommandError(RuntimeError):
    def __init__(self, message: str, output: str):
        super().__init__(message)
        self.output = output


def run_command(args: list[str]) -> str:
    result = subprocess.run(args, check=False, capture_output=True, text=True)
    output = "\n".join(part for part in [result.stdout, result.stderr] if part).strip()
    if result.returncode != 0:
        raise SuricataCommandError(f"Comando fallo: {' '.join(args)}", output)
    return output


async def docker_container_running() -> bool:
    try:
        output = await asyncio.to_thread(
            run_command,
            ["docker", "inspect", "-f", "{{.State.Running}}", settings.suricata_container_name],
        )
    except SuricataCommandError:
        return False
    return output.strip() == "true"


async def get_active_profile(session: AsyncSession) -> SuricataProfile | None:
    result = await session.execute(select(SuricataProfile).where(SuricataProfile.is_active.is_(True)).limit(1))
    return result.scalar_one_or_none()


async def get_last_job(session: AsyncSession) -> SuricataApplyJob | None:
    result = await session.execute(select(SuricataApplyJob).order_by(SuricataApplyJob.created_at.desc()).limit(1))
    return result.scalar_one_or_none()


async def load_render_inputs(
    session: AsyncSession, profile_id: UUID
) -> tuple[SuricataProfile, list[SuricataSource], list[SuricataRuleOverride], list[SuricataCustomRule]]:
    profile = await session.get(SuricataProfile, profile_id)
    if profile is None:
        raise ValueError("Perfil no encontrado")

    sources_result = await session.execute(select(SuricataSource).order_by(SuricataSource.source_name))
    overrides_result = await session.execute(select(SuricataRuleOverride).where(SuricataRuleOverride.profile_id == profile_id).order_by(SuricataRuleOverride.sid))
    rules_result = await session.execute(select(SuricataCustomRule).where(SuricataCustomRule.profile_id == profile_id).order_by(SuricataCustomRule.created_at))
    return profile, list(sources_result.scalars()), list(overrides_result.scalars()), list(rules_result.scalars())


def write_rendered_files(directory: Path, rendered: RenderedSuricataConfig) -> None:
    local_rules_dir = directory / "local-rules"
    local_rules_dir.mkdir(parents=True, exist_ok=True)
    (directory / "enable.conf").write_text(rendered.enable_conf, encoding="utf-8")
    (directory / "disable.conf").write_text(rendered.disable_conf, encoding="utf-8")
    (directory / "drop.conf").write_text(rendered.drop_conf, encoding="utf-8")
    (directory / "modify.conf").write_text(rendered.modify_conf, encoding="utf-8")
    (local_rules_dir / "custom.rules").write_text(rendered.local_rules, encoding="utf-8")


def apply_with_docker(rendered: RenderedSuricataConfig, sources: list[SuricataSource]) -> str:
    outputs: list[str] = []
    container = settings.suricata_container_name
    with tempfile.TemporaryDirectory(prefix="suricata-policy-") as temp_dir:
        temp_path = Path(temp_dir)
        write_rendered_files(temp_path, rendered)
        for file_name in ["enable.conf", "disable.conf", "drop.conf", "modify.conf"]:
            outputs.append(run_command(["docker", "cp", str(temp_path / file_name), f"{container}:/etc/suricata/{file_name}"]))
        outputs.append(run_command(["docker", "exec", container, "mkdir", "-p", "/etc/suricata/local-rules"]))
        outputs.append(run_command(["docker", "cp", str(temp_path / "local-rules" / "custom.rules"), f"{container}:/etc/suricata/local-rules/custom.rules"]))

    for source in sources:
        source_action = "enable-source" if source.enabled else "disable-source"
        outputs.append(run_command(["docker", "exec", container, "suricata-update", source_action, source.source_name]))

    outputs.append(
        run_command(
            [
                "docker",
                "exec",
                container,
                "suricata-update",
                "--suricata-conf",
                "/etc/suricata/suricata.yaml",
                "--enable-conf",
                "/etc/suricata/enable.conf",
                "--disable-conf",
                "/etc/suricata/disable.conf",
                "--drop-conf",
                "/etc/suricata/drop.conf",
                "--local",
                "/etc/suricata/local-rules",
            ]
        )
    )
    outputs.append(run_command(["docker", "exec", container, "suricata", "-T", "-c", "/etc/suricata/suricata.yaml"]))
    outputs.append(
        run_command(
            [
                "docker",
                "exec",
                container,
                "sh",
                "-c",
                "pidof suricata | tr ' ' '\\n' | xargs -r kill -USR2",
            ]
        )
    )
    return "\n".join(output for output in outputs if output)


async def apply_suricata_config(session: AsyncSession, profile_id: UUID | None = None) -> SuricataApplyJob:
    if profile_id is None:
        active_profile = await get_active_profile(session)
        if active_profile is None:
            raise ValueError("No hay perfil activo")
        profile_id = active_profile.id

    _, sources, overrides, custom_rules = await load_render_inputs(session, profile_id)
    rendered = render_suricata_config(overrides, custom_rules)
    now = datetime.now(timezone.utc)
    job = SuricataApplyJob(profile_id=profile_id, status="running", started_at=now, generated_files=rendered.as_dict())
    session.add(job)
    await session.commit()
    await session.refresh(job)

    try:
        output = await asyncio.to_thread(apply_with_docker, rendered, sources)
    except Exception as exc:
        error_output = exc.output if isinstance(exc, SuricataCommandError) else str(exc)
        job.status = "failed"
        job.finished_at = datetime.now(timezone.utc)
        job.command_output = error_output
        job.error_message = str(exc)
        session.add(
            SuricataConfigVersion(
                profile_id=profile_id,
                apply_job_id=job.id,
                status="failed",
                enable_conf=rendered.enable_conf,
                disable_conf=rendered.disable_conf,
                drop_conf=rendered.drop_conf,
                modify_conf=rendered.modify_conf,
                local_rules=rendered.local_rules,
            )
        )
        await session.commit()
        await session.refresh(job)
        return job

    job.status = "success"
    job.finished_at = datetime.now(timezone.utc)
    job.command_output = output
    session.add(
        SuricataConfigVersion(
            profile_id=profile_id,
            apply_job_id=job.id,
            status="applied",
            enable_conf=rendered.enable_conf,
            disable_conf=rendered.disable_conf,
            drop_conf=rendered.drop_conf,
            modify_conf=rendered.modify_conf,
            local_rules=rendered.local_rules,
        )
    )
    await session.commit()
    await session.refresh(job)
    return job

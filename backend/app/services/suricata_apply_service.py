"""Apply Suricata desired policy through the Docker socket."""

import asyncio
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Literal
from uuid import UUID, uuid4

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
from ..suricata_apply_events import broadcast_apply_event
from .suricata_config_renderer import RenderedSuricataConfig, render_suricata_config
from .suricata_list_service import sync_profile_list_rules


APPLY_LOCK = asyncio.Lock()
DEFAULT_COMMAND_TIMEOUT_SECONDS = 300
RELOAD_COMPLETE_TIMEOUT_SECONDS = 180
ApplyMode = Literal["auto", "fast", "full"]
ResolvedApplyMode = Literal["fast", "full"]


class SuricataCommandError(RuntimeError):
    def __init__(self, message: str, output: str):
        super().__init__(message)
        self.output = output


def run_command(args: list[str], timeout: int = DEFAULT_COMMAND_TIMEOUT_SECONDS) -> str:
    try:
        result = subprocess.run(args, check=False, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        output = "\n".join(part for part in [exc.stdout, exc.stderr] if part).strip()
        raise SuricataCommandError(f"Comando excedio {timeout}s: {' '.join(args)}", output) from exc
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


async def get_last_successful_job(session: AsyncSession) -> SuricataApplyJob | None:
    result = await session.execute(
        select(SuricataApplyJob)
        .where(SuricataApplyJob.status == "success")
        .order_by(SuricataApplyJob.created_at.desc())
        .limit(1)
    )
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


def enabled_source_names(sources: list[SuricataSource]) -> list[str]:
    return sorted(source.source_name for source in sources if source.enabled)


def source_state(sources: list[SuricataSource]) -> dict[str, bool]:
    return {source.source_name: source.enabled for source in sorted(sources, key=lambda item: item.source_name)}


def generated_files_with_metadata(rendered: RenderedSuricataConfig, sources: list[SuricataSource], mode: ResolvedApplyMode) -> dict[str, object]:
    files: dict[str, object] = rendered.as_dict()
    files["_apply_mode"] = mode
    files["_enabled_sources"] = enabled_source_names(sources)
    files["_source_state"] = source_state(sources)
    return files


def resolve_apply_mode(requested_mode: ApplyMode, sources: list[SuricataSource], last_successful_job: SuricataApplyJob | None) -> ResolvedApplyMode:
    if requested_mode in {"fast", "full"}:
        return requested_mode
    if last_successful_job is None or not isinstance(last_successful_job.generated_files, dict):
        return "full"
    if last_successful_job.generated_files.get("_enabled_sources") != enabled_source_names(sources):
        return "full"
    return "fast"


def backup_active_files(container: str) -> str:
    backup_dir = f"/tmp/suricata-policy-backup-{uuid4().hex}"
    run_command(
        [
            "docker",
            "exec",
            container,
            "sh",
            "-c",
            f"mkdir -p {backup_dir}/local-rules {backup_dir}/rules && "
            "for file in enable.conf disable.conf drop.conf modify.conf; do "
            f"cp -f /etc/suricata/$file {backup_dir}/$file 2>/dev/null || true; "
            "done && "
            f"cp -f /etc/suricata/local-rules/custom.rules {backup_dir}/local-rules/custom.rules 2>/dev/null || true && "
            f"cp -f /var/lib/suricata/rules/suricata.rules {backup_dir}/rules/suricata.rules 2>/dev/null || true",
        ]
    )
    return backup_dir


def restore_active_files(container: str, backup_dir: str) -> str:
    return run_command(
        [
            "docker",
            "exec",
            container,
            "sh",
            "-c",
            "for file in enable.conf disable.conf drop.conf modify.conf; do "
            f"if [ -f {backup_dir}/$file ]; then cp -f {backup_dir}/$file /etc/suricata/$file; else rm -f /etc/suricata/$file; fi; "
            "done && "
            "mkdir -p /etc/suricata/local-rules && "
            f"if [ -f {backup_dir}/local-rules/custom.rules ]; then "
            f"cp -f {backup_dir}/local-rules/custom.rules /etc/suricata/local-rules/custom.rules; "
            "else rm -f /etc/suricata/local-rules/custom.rules; fi && "
            "mkdir -p /var/lib/suricata/rules && "
            f"if [ -f {backup_dir}/rules/suricata.rules ]; then "
            f"cp -f {backup_dir}/rules/suricata.rules /var/lib/suricata/rules/suricata.rules; "
            "else rm -f /var/lib/suricata/rules/suricata.rules; fi",
        ]
    )


def cleanup_backup(container: str, backup_dir: str) -> None:
    try:
        run_command(["docker", "exec", container, "rm", "-rf", backup_dir])
    except SuricataCommandError:
        pass


def suricata_update_command(container: str, offline: bool) -> list[str]:
    command = [
        "docker",
        "exec",
        container,
        "suricata-update",
        "--no-test",
        "--no-reload",
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
    if offline:
        command.append("--offline")
    return command


def is_missing_offline_cache_error(output: str) -> bool:
    normalized = output.lower()
    return "can't proceed offline" in normalized and "has not yet been downloaded" in normalized


def is_transient_source_fetch_error(output: str) -> bool:
    normalized = output.lower()
    return "read operation timed out" in normalized or "failed to copy file" in normalized


def run_source_updates(container: str, sources: list[SuricataSource], progress: Callable[[str, str], None] | None = None) -> list[str]:
    outputs: list[str] = []
    for index, source in enumerate(sources, start=1):
        source_action = "enable-source" if source.enabled else "disable-source"
        if progress:
            progress("updating_sources", f"{source_action} {source.source_name} ({index}/{len(sources)})")
        outputs.append(run_command(["docker", "exec", container, "suricata-update", source_action, source.source_name]))
    return outputs


def run_suricata_update(container: str, offline: bool, progress: Callable[[str, str], None] | None = None, attempts: int = 2) -> str:
    for attempt in range(1, attempts + 1):
        try:
            return run_command(suricata_update_command(container, offline=offline))
        except SuricataCommandError as exc:
            if offline or attempt >= attempts or not is_transient_source_fetch_error(exc.output):
                raise
            if progress:
                progress("suricata_update_retry", f"Descarga de fuente fallo; reintentando suricata-update ({attempt + 1}/{attempts})")
            time.sleep(3)
    raise RuntimeError("unreachable")


def suricata_log_size(container: str) -> int:
    output = run_command(["docker", "exec", container, "sh", "-c", "wc -c < /var/log/suricata/suricata.log 2>/dev/null || echo 0"])
    try:
        return int(output.strip().splitlines()[-1])
    except (IndexError, ValueError):
        return 0


def wait_for_rule_reload_complete(container: str, offset: int, timeout: int = RELOAD_COMPLETE_TIMEOUT_SECONDS) -> None:
    deadline = time.monotonic() + timeout
    start_byte = max(offset + 1, 1)
    command = f"tail -c +{start_byte} /var/log/suricata/suricata.log 2>/dev/null | grep -q 'rule reload complete'"

    while time.monotonic() < deadline:
        try:
            run_command(["docker", "exec", container, "sh", "-c", command], timeout=10)
            return
        except SuricataCommandError:
            time.sleep(2)

    raise SuricataCommandError(f"Suricata no confirmo rule reload complete en {timeout}s", "")


def apply_with_docker(
    rendered: RenderedSuricataConfig,
    sources: list[SuricataSource],
    mode: ResolvedApplyMode,
    progress: Callable[[str, str], None] | None = None,
) -> str:
    outputs: list[str] = []
    container = settings.suricata_container_name
    if progress:
        progress("backup", "Respaldando configuracion activa")
    backup_dir = backup_active_files(container)
    try:
        with tempfile.TemporaryDirectory(prefix="suricata-policy-") as temp_dir:
            temp_path = Path(temp_dir)
            if progress:
                progress("writing_files", "Generando archivos de politica")
            write_rendered_files(temp_path, rendered)
            if progress:
                progress("copying_files", "Copiando reglas al contenedor Suricata")
            for file_name in ["enable.conf", "disable.conf", "drop.conf", "modify.conf"]:
                outputs.append(run_command(["docker", "cp", str(temp_path / file_name), f"{container}:/etc/suricata/{file_name}"]))
            outputs.append(run_command(["docker", "exec", container, "mkdir", "-p", "/etc/suricata/local-rules"]))
            outputs.append(run_command(["docker", "cp", str(temp_path / "local-rules" / "custom.rules"), f"{container}:/etc/suricata/local-rules/custom.rules"]))

        if mode == "full":
            outputs.extend(run_source_updates(container, sources, progress))
            if progress:
                progress("suricata_update", "Descargando y compilando reglas con suricata-update")
            outputs.append(run_suricata_update(container, offline=False, progress=progress))
        else:
            if progress:
                progress("fast_update", "Regenerando ruleset local desde cache de suricata-update")
            try:
                outputs.append(run_command(suricata_update_command(container, offline=True)))
            except SuricataCommandError as exc:
                if not is_missing_offline_cache_error(exc.output):
                    raise
                if progress:
                    progress("suricata_update", "Cache local incompleto; ejecutando actualizacion completa")
                if exc.output:
                    outputs.append(exc.output)
                outputs.extend(run_source_updates(container, sources, progress))
                outputs.append(run_suricata_update(container, offline=False, progress=progress))
        if progress:
            progress("testing_config", "Validando configuracion con suricata -T")
        outputs.append(run_command(["docker", "exec", container, "suricata", "-T", "-c", "/etc/suricata/suricata.yaml"], timeout=240))
    except Exception as exc:
        if progress:
            progress("rollback", "Fallo la aplicacion; restaurando configuracion anterior")
        try:
            restore_output = restore_active_files(container, backup_dir)
            if restore_output:
                outputs.append(restore_output)
        except SuricataCommandError as restore_exc:
            raise SuricataCommandError(f"{exc}; ademas fallo la restauracion", "\n".join([getattr(exc, "output", str(exc)), restore_exc.output])) from exc
        raise
    finally:
        cleanup_backup(container, backup_dir)

    if progress:
        progress("reloading", "Recargando Suricata con senal USR2")
    log_offset = suricata_log_size(container)
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
    if progress:
        progress("waiting_reload", "Esperando confirmacion de recarga completa de Suricata")
    wait_for_rule_reload_complete(container, log_offset)
    return "\n".join(output for output in outputs if output)


async def apply_suricata_config(session: AsyncSession, profile_id: UUID | None = None, mode: ApplyMode = "auto") -> SuricataApplyJob:
    if APPLY_LOCK.locked():
        raise ValueError("Ya hay una aplicacion de Suricata en curso. Espera a que termine antes de aplicar otra vez.")

    async with APPLY_LOCK:
        return await _apply_suricata_config(session, profile_id, mode)


async def _apply_suricata_config(session: AsyncSession, profile_id: UUID | None = None, mode: ApplyMode = "auto") -> SuricataApplyJob:
    if profile_id is None:
        active_profile = await get_active_profile(session)
        if active_profile is None:
            raise ValueError("No hay perfil activo")
        profile_id = active_profile.id

    await broadcast_apply_event({"status": "running", "step": "syncing_lists", "message": "Sincronizando listas con reglas locales", "profile_id": str(profile_id)})
    await sync_profile_list_rules(session, profile_id)
    await broadcast_apply_event({"status": "running", "step": "rendering", "message": "Renderizando configuracion Suricata", "profile_id": str(profile_id)})
    _, sources, overrides, custom_rules = await load_render_inputs(session, profile_id)
    rendered = render_suricata_config(overrides, custom_rules)
    resolved_mode = resolve_apply_mode(mode, sources, await get_last_successful_job(session))
    mode_label = "rapido" if resolved_mode == "fast" else "completo"
    now = datetime.now(timezone.utc)
    job = SuricataApplyJob(profile_id=profile_id, status="running", started_at=now, generated_files=generated_files_with_metadata(rendered, sources, resolved_mode))
    session.add(job)
    await session.commit()
    await session.refresh(job)
    await broadcast_apply_event({"job_id": str(job.id), "profile_id": str(profile_id), "status": "running", "step": "started", "message": f"Job de aplicacion {mode_label} iniciado"})

    loop = asyncio.get_running_loop()

    def publish_progress(step: str, message: str) -> None:
        asyncio.run_coroutine_threadsafe(
            broadcast_apply_event({"job_id": str(job.id), "profile_id": str(profile_id), "status": "running", "step": step, "message": message}),
            loop,
        )

    try:
        output = await asyncio.to_thread(apply_with_docker, rendered, sources, resolved_mode, publish_progress)
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
        await broadcast_apply_event({"job_id": str(job.id), "profile_id": str(profile_id), "status": "failed", "step": "failed", "message": str(exc), "error_message": str(exc)})
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
    await broadcast_apply_event({"job_id": str(job.id), "profile_id": str(profile_id), "status": "success", "step": "success", "message": f"Configuracion aplicada con modo {mode_label} y Suricata recargado"})
    return job

"""Sistema de filtrado de eventos Suricata."""

from typing import Any, Dict, List, Optional, Callable
from enum import Enum
import json


class EventType(str, Enum):
    """Tipos de eventos que Suricata puede generar."""

    ALERT = "alert"
    HTTP = "http"
    DNS = "dns"
    TLS = "tls"
    SSH = "ssh"
    FTP = "ftp"
    SMTP = "smtp"
    FLOW = "flow"
    STATS = "stats"
    ALL = "all"


class SeverityLevel(str, Enum):
    """Niveles de severidad para alertas."""

    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


class EventFilter:
    """Filtro configurable para eventos de Suricata."""

    def __init__(
        self,
        event_types: Optional[List[EventType]] = None,
        min_severity: Optional[int] = None,
        source_ips: Optional[List[str]] = None,
        dest_ips: Optional[List[str]] = None,
        keywords: Optional[List[str]] = None,
        exclude_keywords: Optional[List[str]] = None,
    ):
        """
        Inicializa el filtro.

        Args:
            event_types: Tipos de eventos a incluir (None = todos).
            min_severity: Severidad mínima (1=critical, 4=low).
            source_ips: IPs origen a filtrar (None = todas).
            dest_ips: IPs destino a filtrar (None = todas).
            keywords: Palabras clave que debe contener el mensaje.
            exclude_keywords: Palabras clave a excluir.
        """
        self.event_types = event_types or [EventType.ALL]
        self.min_severity = min_severity  # 1=crit, 4=low, None=todas
        self.source_ips = source_ips or []
        self.dest_ips = dest_ips or []
        self.keywords = keywords or []
        self.exclude_keywords = exclude_keywords or []

    def matches(self, event: Dict[str, Any]) -> bool:
        """
        Evalua si el evento cumple los criterios del filtro.

        Args:
            event: Diccionario del evento.

        Returns:
            True si pasa el filtro, False en caso contrario.
        """
        event_type = event.get("event_type", "").lower()

        # Filtro de tipo de evento
        if (
            self.event_types
            and EventType.ALL not in self.event_types
            and event_type not in [et.value for et in self.event_types]
        ):
            return False

        # Filtro de severidad (solo para alertas)
        if event_type == EventType.ALERT.value and self.min_severity:
            alert = event.get("alert", {})
            severity = alert.get("severity", 4)
            if severity > self.min_severity:
                return False

        # Filtro de IPs origen
        if self.source_ips:
            src_ip = event.get("src_ip")
            if src_ip not in self.source_ips:
                return False

        # Filtro de IPs destino
        if self.dest_ips:
            dst_ip = event.get("dest_ip")
            if dst_ip not in self.dest_ips:
                return False

        # Filtro de palabras clave (presencia)
        if self.keywords:
            event_str = json.dumps(event).lower()
            if not any(kw.lower() in event_str for kw in self.keywords):
                return False

        # Filtro de exclusión de palabras clave
        if self.exclude_keywords:
            event_str = json.dumps(event).lower()
            if any(kw.lower() in event_str for kw in self.exclude_keywords):
                return False

        return True


class DefaultFilters:
    """Filtros predefinidos comunes."""

    @staticmethod
    def high_priority_alerts() -> EventFilter:
        """Alertas de alta prioridad (severidad crítica y alta)."""
        return EventFilter(
            event_types=[EventType.ALERT],
            min_severity=SeverityLevel.HIGH.value,
        )

    @staticmethod
    def suspicious_ssh() -> EventFilter:
        """Eventos sospechosos de SSH."""
        return EventFilter(
            event_types=[EventType.ALERT, EventType.SSH],
            keywords=["ssh", "brute", "force", "auth"],
        )

    @staticmethod
    def suspicious_dns() -> EventFilter:
        """Consultas DNS sospechosas."""
        return EventFilter(
            event_types=[EventType.ALERT, EventType.DNS],
            keywords=["dns", "tunnel", "exfil"],
        )

    @staticmethod
    def blocked_connections() -> EventFilter:
        """Conexiones bloqueadas."""
        return EventFilter(
            event_types=[EventType.ALERT],
            keywords=["drop", "reject", "block"],
        )

    @staticmethod
    def no_stats() -> EventFilter:
        """Excluir eventos de estadísticas."""
        return EventFilter(exclude_keywords=["stats", "pcap"])

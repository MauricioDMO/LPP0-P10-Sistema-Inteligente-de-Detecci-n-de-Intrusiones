import type { SuricataEvent } from "@/types/suricata";
import { getDstIP, getEventType, getMessage, getSeverity, getSrcIP, getTimestamp } from "./suricata";

export function exportEventsCsv(events: SuricataEvent[]): void {
  const header = "Tipo,Tiempo,Origen,Destino,Mensaje,Severidad,Maliciosa,Confianza,Reportes,País Origen,País Destino\n";
  const rows = events
    .map((evt) => {
      const msg = getMessage(evt).replaceAll('"', '""');
      const isMalicious = evt._threat?.is_malicious ?? false;
      const confidence = evt._threat?.confidence ?? 0;
      const reports = evt._threat?.total_reports ?? 0;
      const srcCountry = evt._geo?.source?.country ?? "";
      const dstCountry = evt._geo?.destination?.country ?? "";

      return `"${getEventType(evt)}","${getTimestamp(evt)}","${getSrcIP(evt)}","${getDstIP(evt)}","${msg}",${getSeverity(evt)},${isMalicious},${confidence},${reports},"${srcCountry}","${dstCountry}"`;
    })
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `suricata_export_${new Date().toISOString().slice(0, 19)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

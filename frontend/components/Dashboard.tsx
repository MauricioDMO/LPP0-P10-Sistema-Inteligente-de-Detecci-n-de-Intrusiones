"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportEventsCsv } from "@/lib/csv";
import { WS_URL } from "@/lib/config";
import { buildStats, getEventType, matchesFilter } from "@/lib/suricata";
import type { ConnectionStatus, EventFilterType, SuricataEvent } from "@/types/suricata";
import { EventCharts } from "./EventCharts";
import { EventControls } from "./EventControls";
import { EventTable } from "./EventTable";
import { GeoMap } from "./GeoMap";
import { Header } from "./Header";
import { StatsBar } from "./StatsBar";

export function Dashboard() {
  const [events, setEvents] = useState<SuricataEvent[]>([]);
  const [filterType, setFilterType] = useState<EventFilterType>("all");
  const [filterSeverity, setFilterSeverity] = useState(0);
  const [filterSearch, setFilterSearch] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [mapResetKey, setMapResetKey] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;

    function connect() {
      if (stopped) return;

      try {
        wsRef.current = new WebSocket(WS_URL);
      } catch {
        reconnectTimerRef.current = setTimeout(connect, 3000);
        return;
      }

      wsRef.current.onopen = () => setConnectionStatus("connected");
      wsRef.current.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as SuricataEvent;
          if (event.type === "pong") return;

          const eventType = getEventType(event);
          if (eventType === "stats" || eventType === "pcap") return;

          setEvents((currentEvents) => [event, ...currentEvents].slice(0, 500));
        } catch {
          // Ignore malformed real-time messages instead of dropping the connection.
        }
      };
      wsRef.current.onclose = () => {
        setConnectionStatus("disconnected");
        if (!stopped) reconnectTimerRef.current = setTimeout(connect, 3000);
      };
      wsRef.current.onerror = () => setConnectionStatus("error");
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  const stats = useMemo(() => buildStats(events), [events]);
  const filteredEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filterType, filterSeverity, filterSearch)),
    [events, filterType, filterSeverity, filterSearch],
  );

  function clearEvents() {
    setEvents([]);
    setMapResetKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
        <Header totalEvents={stats.total} status={connectionStatus} />
        <StatsBar stats={stats} />
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.72fr)]" aria-label="Visualización de amenazas">
          <EventCharts events={events} />
          <GeoMap events={events} resetKey={mapResetKey} />
        </section>
        <EventControls
          filterType={filterType}
          filterSeverity={filterSeverity}
          filterSearch={filterSearch}
          onFilterTypeChange={setFilterType}
          onSeverityChange={setFilterSeverity}
          onSearchChange={setFilterSearch}
          onExport={() => exportEventsCsv(filteredEvents)}
          onClear={clearEvents}
        />
        <EventTable events={filteredEvents} />
      </div>
    </main>
  );
}

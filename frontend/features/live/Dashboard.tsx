"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportEventsCsv } from "@/lib/csv";
import { WS_URL } from "@/lib/config";
import { buildStats, getEventType, matchesFilter } from "@/lib/suricata";
import { GeoMap } from "@/shared/components/maps/GeoMap";
import type { ConnectionStatus, EventFilterType, SuricataEvent } from "@/types/suricata";
import { EventCharts } from "./components/EventCharts";
import { EventControls } from "./components/EventControls";
import { EventTable } from "./components/EventTable";
import { Header } from "./components/Header";
import { StatsBar } from "./components/StatsBar";

const DEFAULT_EVENT_LIMIT = 500;
const DEFAULT_REFRESH_MS = 1000;

export function Dashboard() {
  const [events, setEvents] = useState<SuricataEvent[]>([]);
  const [filterType, setFilterType] = useState<EventFilterType>("all");
  const [filterSeverity, setFilterSeverity] = useState(0);
  const [filterSearch, setFilterSearch] = useState("");
  const [eventLimit, setEventLimit] = useState(DEFAULT_EVENT_LIMIT);
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [mapResetKey, setMapResetKey] = useState(0);
  const eventLimitRef = useRef(DEFAULT_EVENT_LIMIT);
  const refreshMsRef = useRef(DEFAULT_REFRESH_MS);
  const pendingEventsRef = useRef<SuricataEvent[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function flushPendingEvents() {
      if (pendingEventsRef.current.length === 0) return;

      const nextEvents = pendingEventsRef.current.slice().reverse();
      pendingEventsRef.current = [];
      setEvents((currentEvents) => [...nextEvents, ...currentEvents].slice(0, eventLimitRef.current));
    }

    flushPendingEvents();
    if (refreshMs === 0) return;

    const timer = setInterval(flushPendingEvents, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

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

          if (refreshMsRef.current === 0) {
            setEvents((currentEvents) => [event, ...currentEvents].slice(0, eventLimitRef.current));
            return;
          }

          pendingEventsRef.current.push(event);
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
    pendingEventsRef.current = [];
    setMapResetKey((key) => key + 1);
  }

  function handleEventLimitChange(limit: number) {
    eventLimitRef.current = limit;
    setEventLimit(limit);
    setEvents((currentEvents) => currentEvents.slice(0, limit));
  }

  function handleRefreshMsChange(nextRefreshMs: number) {
    refreshMsRef.current = nextRefreshMs;
    setRefreshMs(nextRefreshMs);
  }

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-450 flex-col gap-3">
        <Header totalEvents={stats.total} eventLimit={eventLimit} status={connectionStatus} />
        <StatsBar stats={stats} />
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.72fr)]" aria-label="Visualización de amenazas en vivo">
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
          eventLimit={eventLimit}
          refreshMs={refreshMs}
          onEventLimitChange={handleEventLimitChange}
          onRefreshMsChange={handleRefreshMsChange}
          onExport={() => exportEventsCsv(filteredEvents)}
          onClear={clearEvents}
        />
        <EventTable events={filteredEvents} />
      </div>
    </main>
  );
}

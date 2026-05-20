"use client";

import { useState } from "react";
import { PageHeading } from "@/features/analytics/components/PageHeading";
import { TimeRangeSelector } from "@/features/analytics/components/TimeRangeSelector";
import type { TimeRangeHours } from "@/types/analytics";
import { HistoricalOverviewSection } from "./components/HistoricalOverview";
import { HistoricalTimeline } from "./components/HistoricalTimeline";

export function HistoricalDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRangeHours>(24);

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-450 flex-col gap-3">
        <PageHeading eyebrow="Elasticsearch" title="Histórico de eventos" description="KPIs y tendencia temporal obtenidos desde los endpoints históricos de analytics." />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <HistoricalOverviewSection hours={timeRange} />
        <HistoricalTimeline hours={timeRange} />
      </div>
    </main>
  );
}

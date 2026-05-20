"use client";

import { useState } from "react";
import { PageHeading } from "@/features/analytics/components/PageHeading";
import { TimeRangeSelector } from "@/features/analytics/components/TimeRangeSelector";
import type { TimeRangeHours } from "@/types/analytics";
import { HistoricalGeoPanel } from "./components/HistoricalGeoPanel";

export function GeoDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRangeHours>(24);

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
        <PageHeading eyebrow="Geo analytics" title="Geografía y mapa de calor" description="Muestra histórica enriquecida por ubicación para detectar concentración de actividad por país, ciudad e ISP." />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <HistoricalGeoPanel hours={timeRange} />
      </div>
    </main>
  );
}

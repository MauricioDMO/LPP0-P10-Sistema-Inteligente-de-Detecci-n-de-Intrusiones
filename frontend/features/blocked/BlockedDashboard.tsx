"use client";

import { useState } from "react";
import { PageHeading } from "@/features/analytics/components/PageHeading";
import { TimeRangeSelector } from "@/features/analytics/components/TimeRangeSelector";
import { InvestigationEventsPanel } from "@/features/analytics/components/InvestigationEventsPanel";
import type { TimeRangeHours } from "@/types/analytics";
import { BlockedPanel } from "./components/BlockedPanel";

export function BlockedDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRangeHours>(24);

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-450 flex-col gap-3">
        <PageHeading eyebrow="IPS" title="Bloqueos" description="Vista dedicada para probar que las reglas de bloqueo están actuando y qué IPs participan." />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <BlockedPanel hours={timeRange} />
        <InvestigationEventsPanel hours={timeRange} mode="blocked" />
      </div>
    </main>
  );
}

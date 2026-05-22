"use client";

import { useState } from "react";
import { PageHeading } from "@/features/analytics/components/PageHeading";
import { TimeRangeSelector } from "@/features/analytics/components/TimeRangeSelector";
import type { TimeRangeHours } from "@/types/analytics";
import { TopIpsPanel } from "./components/TopIpsPanel";
import { TopSignatures } from "./components/TopSignatures";

export function RankingsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRangeHours>(24);

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
        <PageHeading eyebrow="Top N" title="Rankings" description="IPs y firmas más activas para priorizar investigación y explicar qué reglas disparan más eventos." />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Rankings históricos">
          <TopIpsPanel hours={timeRange} />
          <TopSignatures hours={timeRange} />
        </section>
      </div>
    </main>
  );
}

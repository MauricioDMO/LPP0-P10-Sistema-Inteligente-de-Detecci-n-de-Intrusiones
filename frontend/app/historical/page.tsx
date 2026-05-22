import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { HistoricalDashboard } from "@/features/historical/HistoricalDashboard";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function HistoricalPage() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <HistoricalDashboard />
    </ProtectedRoute>
  );
}

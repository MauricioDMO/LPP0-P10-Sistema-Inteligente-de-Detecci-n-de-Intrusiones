import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RankingsDashboard } from "@/features/rankings/RankingsDashboard";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function RankingsPage() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <RankingsDashboard />
    </ProtectedRoute>
  );
}

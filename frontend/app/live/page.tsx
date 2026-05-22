import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { Dashboard } from "@/features/live/Dashboard";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function LivePage() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <Dashboard />
    </ProtectedRoute>
  );
}

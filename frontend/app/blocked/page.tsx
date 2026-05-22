import { BlockedDashboard } from "@/features/blocked/BlockedDashboard";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function BlockedPage() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <BlockedDashboard />
    </ProtectedRoute>
  );
}

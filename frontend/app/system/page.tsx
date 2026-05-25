import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { SystemDashboardPage } from "@/features/system/SystemDashboardPage";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function Page() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <SystemDashboardPage />
    </ProtectedRoute>
  );
}

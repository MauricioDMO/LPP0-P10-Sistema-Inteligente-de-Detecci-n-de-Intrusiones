import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { GeoDashboard } from "@/features/geo/GeoDashboard";

const OPERATIONAL_ROLES = ["admin", "analyst", "viewer"];

export default function GeoPage() {
  return (
    <ProtectedRoute roles={OPERATIONAL_ROLES}>
      <GeoDashboard />
    </ProtectedRoute>
  );
}

import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { SuricataManagementShell } from "@/features/suricata/SuricataManagementShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["admin", "analyst"]}>
      <SuricataManagementShell>{children}</SuricataManagementShell>
    </ProtectedRoute>
  );
}

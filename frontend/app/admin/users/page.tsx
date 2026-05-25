import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { UserManagementPage } from "@/features/admin/users/UserManagementPage";

export default function Page() {
  return (
    <ProtectedRoute roles={["admin"]}>
      <UserManagementPage />
    </ProtectedRoute>
  );
}

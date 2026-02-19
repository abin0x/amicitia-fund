import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

/**
 * On the "/" route, redirect admins in admin view mode to /admin.
 * Members (or admins in member view) see the member dashboard.
 */
export default function ViewModeRedirect({ children }: { children: React.ReactNode }) {
  const { role, viewMode } = useAuth();

  if (role === "admin" && viewMode === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

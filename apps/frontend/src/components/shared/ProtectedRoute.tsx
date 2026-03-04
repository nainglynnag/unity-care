import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken, getCurrentUser } from "../../lib/api";

type Props = {
  allowedRoles: string[];
  redirectTo?: string;
};

/**
 * Role-based route guard.
 *
 * - No token → redirect to the provided `redirectTo` (default `/signin`).
 * - Token present but role not in `allowedRoles` → redirect to the
 *   appropriate home for the user's actual role.
 * - Passes through → renders `<Outlet />`.
 */
export function ProtectedRoute({ allowedRoles, redirectTo = "/signin" }: Props) {
  const token = getAccessToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to={redirectTo} replace />;
  }

  const role = user.role ?? "CIVILIAN";

  if (!allowedRoles.includes(role)) {
    const home = roleHome(role);
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}

function roleHome(role: string): string {
  switch (role) {
    case "SUPERADMIN":
    case "ADMIN":
      return "/admin-dashboard";
    case "VOLUNTEER":
      return "/volunteer-dashboard";
    default:
      return "/choosehelp";
  }
}

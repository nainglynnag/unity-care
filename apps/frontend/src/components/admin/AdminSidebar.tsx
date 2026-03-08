import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileCheck,
  UserCog,
  LogOut,
  Shield,
  Database,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE, authFetch, clearAuthTokens, getRefreshToken, getCurrentUser } from "@/lib/api";

const baseNavItems = [
  { to: "/admin-dashboard", end: true, label: "Overview", icon: LayoutDashboard, superadminOnly: false },
  { to: "/admin-dashboard/users", end: false, label: "Users", icon: Users, superadminOnly: true },
  { to: "/admin-dashboard/applications", end: false, label: "Applications", icon: FileCheck, superadminOnly: false },
  { to: "/admin-dashboard/volunteer-roles", end: false, label: "Volunteer Roles", icon: UserCog, superadminOnly: true },
  { to: "/admin-dashboard/reference-data", end: false, label: "Reference Data", icon: Database, superadminOnly: true },
] as const;

type AdminSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ open = true, onClose }: AdminSidebarProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isMobile = typeof onClose === "function";

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authFetch(`${API_BASE}/auth/signout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }, false);
      } catch {
        /* best-effort */
      }
    }
    clearAuthTokens();
    navigate("/admin-signin", { replace: true });
  };

  return (
    <aside
      className={cn(
        "w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-40 transition-transform duration-200 ease-out",
        isMobile && "fixed inset-y-0 left-0",
        isMobile && !open && "-translate-x-full"
      )}
    >
      <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-white text-xl font-bold">Unity Care</span>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-gray-800 shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5" onClick={isMobile ? onClose : undefined}>
        {baseNavItems.filter((item) => !item.superadminOnly || user?.role === "SUPERADMIN").map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-white/70 hover:text-white hover:bg-gray-800",
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-3">
        {user && (
          <div className="px-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              <span
                className={cn(
                  "shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                  user.role === "SUPERADMIN" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                )}
              >
                {user.role === "SUPERADMIN" ? "Super Admin" : "Admin"}
              </span>
            </div>
            <p className="text-white/40 text-xs truncate">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-semibold transition-colors"
        >
          <LogOut className="w-4 h-4" />
          LOGOUT
        </button>
      </div>
    </aside>
  );
}

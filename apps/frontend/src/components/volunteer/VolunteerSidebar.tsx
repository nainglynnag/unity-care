import { NavLink, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, User, LogOut, LogIn, Radio, History, Users, BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE, clearAuthTokens, getAccessToken, getRefreshToken, authFetch } from "@/lib/api";
import { updateAvailability } from "@/lib/volunteerProfile";
import { NotificationBell } from "./NotificationPanel";
import { useVolunteerAgency } from "./VolunteerAgencyContext";

const dashboardItem = {
  to: "/volunteer-dashboard",
  end: true,
  label: "Dashboard",
  icon: LayoutDashboard,
} as const;

const LEADERSHIP_ONLY = new Set(["/volunteer-dashboard/analytics", "/volunteer-dashboard/team", "/volunteer-dashboard/mission-history"]);

const protectedNavItems = [
  { to: "/volunteer-dashboard/missions", end: false, label: "Missions", icon: Radio },
  { to: "/volunteer-dashboard/mission-history", end: false, label: "History", icon: History },
  { to: "/volunteer-dashboard/validation", end: false, label: "Validation", icon: ShieldCheck },
  { to: "/volunteer-dashboard/team", end: false, label: "Team", icon: Users },
  { to: "/volunteer-dashboard/analytics", end: false, label: "Analytics", icon: BarChart3 },
  { to: "/volunteer-dashboard/profile", end: false, label: "Profile", icon: User },
] as const;

type VolunteerSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function VolunteerSidebar({ open = true, onClose }: VolunteerSidebarProps) {
  const navigate = useNavigate();
  const isMobile = typeof onClose === "function";
  const isSignedIn = !!getAccessToken();
  const { membership } = useVolunteerAgency();
  const isLeadership =
    membership?.myRole === "COORDINATOR" || membership?.myRole === "DIRECTOR";

  const handleLogout = async () => {
    if (isSignedIn) {
      try {
        await updateAvailability({ isAvailable: false });
      } catch {
        /* best-effort */
      }

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
    }

    clearAuthTokens();
    navigate("/volunteer-signin", { replace: true });
  };

  return (
    <aside
      className={cn(
        "w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-40 transition-transform duration-200 ease-out",
        isMobile && "fixed inset-y-0 left-0 lg:relative lg:translate-x-0",
        isMobile && !open && "-translate-x-full"
      )}
    >
      {/* Logo & title */}
      <div className="p-5 border-b border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-500"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="text-white text-xl font-bold block truncate">Unity Care</span>
            <span className="text-white/60 text-xs font-medium tracking-wider block">VOLUNTEER CENTER</span>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-gray-800 lg:hidden shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav — close drawer on nav click (mobile) */}
      <nav className="flex-1 py-4 px-3 space-y-0.5" onClick={isMobile ? onClose : undefined}>
        <NavLink
          to={dashboardItem.to}
          end={dashboardItem.end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-red-500/20 text-red-500"
                : "text-white/70 hover:text-white hover:bg-gray-800"
            )
          }
        >
          <dashboardItem.icon className="w-5 h-5 shrink-0" />
          <span>{dashboardItem.label}</span>
        </NavLink>
        {isSignedIn &&
          protectedNavItems
          .filter((item) => !LEADERSHIP_ONLY.has(item.to) || isLeadership)
          .map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-red-500/20 text-red-500"
                    : "text-white/70 hover:text-white hover:bg-gray-800"
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
      </nav>

      {/* Notifications + Logout / Sign in */}
      <div className="p-4 border-t border-gray-800 space-y-2">
        {isSignedIn && (
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-white/40 text-[10px] font-semibold tracking-widest">ALERTS</span>
            <NotificationBell />
          </div>
        )}
        {isSignedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            LOGOUT
          </button>
        ) : (
          <Link
            to="/volunteer-signin"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            <LogIn className="w-4 h-4" />
            SIGN IN
          </Link>
        )}
      </div>
    </aside>
  );
}

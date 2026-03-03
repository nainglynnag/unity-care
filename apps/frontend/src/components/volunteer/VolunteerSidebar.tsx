import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  ShieldCheck,
  User,
  Circle,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuthTokens, getAccessToken } from "@/lib/api";

const dashboardItem = {
  to: "/volunteer-dashboard",
  end: true,
  label: "Dashboard",
  icon: LayoutDashboard,
} as const;

const protectedNavItems = [
  { to: "/volunteer-dashboard/missions", end: false, label: "Missions", icon: ClipboardCheck },
  { to: "/volunteer-dashboard/validation", end: false, label: "Validation", icon: ShieldCheck },
  { to: "/volunteer-dashboard/profile", end: false, label: "Profile", icon: User },
] as const;

export function VolunteerSidebar() {
  const navigate = useNavigate();
  const isSignedIn = !!getAccessToken();

  const handleLogout = () => {
    clearAuthTokens();
    navigate(-1);
  };

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo & title */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
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
          <span className="text-white text-xl font-bold">Unity Care</span>
        </div>
        <p className="text-white/60 text-xs font-medium mt-2 tracking-wider">
          VOLUNTEER CENTER
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
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
          protectedNavItems.map(({ to, end, label, icon: Icon }) => (
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

      {/* System status + Logout / Sign in */}
      <div className="p-4 border-t border-gray-800 space-y-2">
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

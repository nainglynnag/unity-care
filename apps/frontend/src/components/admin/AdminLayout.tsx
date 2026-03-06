import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";

const SIDEBAR_BREAKPOINT = 1024;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < SIDEBAR_BREAKPOINT : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-gray-950 flex relative">
      {isMobile && sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-30"
          aria-label="Close menu"
        />
      )}
      <AdminSidebar open={sidebarOpen} onClose={isMobile ? () => setSidebarOpen(false) : undefined} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-gray-950/95 border-b border-gray-800 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-gray-800"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-white font-semibold">Admin</span>
        </header>
        <main className="flex-1 overflow-auto min-w-0">
          <div className="relative min-h-full">
            <div
              className="absolute inset-0 bg-gradient-radial from-gray-900 via-gray-950 to-gray-950 pointer-events-none"
              aria-hidden
            />
            <div className="relative z-10 h-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

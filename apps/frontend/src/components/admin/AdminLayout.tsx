import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
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
  );
}

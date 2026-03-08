import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

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
import toast from "react-hot-toast";
import { Menu } from "lucide-react";
import { VolunteerSidebar } from "./VolunteerSidebar";
import { VolunteerAgencyProvider } from "./VolunteerAgencyContext";
import { API_BASE, getAccessToken, getCurrentUser } from "../../lib/api";

export function VolunteerLayout() {
  // Set up real-time incident & mission notifications for volunteers
  useEffect(() => {
    const accessToken = getAccessToken();
    const user = getCurrentUser();

    if (!accessToken || user?.role !== "VOLUNTEER") {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: number | undefined;
    let connectTimeout: number | undefined;
    let closedManually = false;

    const connect = () => {
      const freshToken = getAccessToken();
      if (!freshToken) return;

      const wsBase = API_BASE.replace(/^http/, "ws").replace(/\/api\/v1$/, "");
      ws = new WebSocket(`${wsBase}/ws`);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "AUTH", token: freshToken }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === "NOTIFICATION") {
            const n = msg.data;

            if (n?.type === "INCIDENT_CREATED") {
              const key =
                n.referenceType && n.referenceId
                  ? `${n.referenceType}:${n.referenceId}:${n.type}`
                  : undefined;

              toast(
                () => (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {n.title ?? "New incident reported"}
                    </p>
                    <p className="text-xs text-gray-300">
                      {n.message ??
                        "A new incident has been reported and may require validation. Please check the Validation tab."}
                    </p>
                  </div>
                ),
                {
                  id: key,
                  duration: 8000,
                },
              );

              window.dispatchEvent(
                new CustomEvent("unitycare:incident-created", {
                  detail: {
                    referenceType: n.referenceType,
                    referenceId: n.referenceId,
                    title: n.title,
                    message: n.message,
                  },
                }),
              );
            }

            if (n.referenceType === "MISSION" && n.referenceId) {
              const missionEventMap: Record<string, string> = {
                MISSION_ASSIGNED: "unitycare:mission-assigned",
                MISSION_ACCEPTED: "unitycare:mission-accepted",
                MISSION_REJECTED: "unitycare:mission-rejected",
                MISSION_EN_ROUTE: "unitycare:mission-en-route",
                MISSION_ON_SITE: "unitycare:mission-on-site",
                MISSION_IN_PROGRESS: "unitycare:mission-in-progress",
                MISSION_COMPLETED: "unitycare:mission-completed",
                MISSION_CLOSED: "unitycare:mission-closed",
                MISSION_FAILED: "unitycare:mission-failed",
              };
              const eventName = missionEventMap[n.type];
              if (eventName) {
                window.dispatchEvent(
                  new CustomEvent(eventName, {
                    detail: {
                      missionId: n.referenceId,
                      title: n.title,
                      message: n.message,
                    },
                  }),
                );
              }
            }
          }
        } catch {
          // Ignore malformed WS messages
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (closedManually) return;
        reconnectTimeout = window.setTimeout(connect, 3000);
      };
    };

    // Defer connect so Strict Mode / quick unmount doesn't close before connection is established
    connectTimeout = window.setTimeout(connect, 150);

    return () => {
      closedManually = true;
      if (connectTimeout !== undefined) {
        window.clearTimeout(connectTimeout);
      }
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
      }
      ws?.close();
    };
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <VolunteerAgencyProvider>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <div className="flex flex-1 min-w-0 relative">
          {isMobile && sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-30"
              aria-label="Close menu"
            />
          )}
          <VolunteerSidebar open={sidebarOpen} onClose={isMobile ? () => setSidebarOpen(false) : undefined} />
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
              <span className="text-white font-semibold">Unity Care</span>
            </header>
            <main className="flex-1 overflow-auto relative">
              <div
                className="absolute inset-0 bg-gradient-radial from-gray-900 via-gray-950 to-gray-950 pointer-events-none"
                aria-hidden
              />
              <div className="relative z-10 h-full">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </VolunteerAgencyProvider>
  );
}

import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import toast from "react-hot-toast";
import { VolunteerSidebar } from "./VolunteerSidebar";
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

    connect();

    return () => {
      closedManually = true;
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
      }
      ws?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex flex-1 min-w-0">
        <VolunteerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
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
  );
}

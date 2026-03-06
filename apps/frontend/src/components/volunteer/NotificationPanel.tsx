import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  Loader2,
  CheckCheck,
  AlertTriangle,
  Radio,
  ShieldCheck,
  FileText,
  User,
} from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/lib/notifications";
import { getAccessToken } from "@/lib/api";

const TYPE_ICONS: Record<string, typeof Bell> = {
  INCIDENT_CREATED: AlertTriangle,
  MISSION_ASSIGNED: Radio,
  MISSION_UPDATED: Radio,
  VERIFICATION_ASSIGNED: ShieldCheck,
  APPLICATION_UPDATED: FileText,
  ACCOUNT_UPDATED: User,
};

const TYPE_COLORS: Record<string, string> = {
  INCIDENT_CREATED: "text-amber-400",
  MISSION_ASSIGNED: "text-red-400",
  MISSION_UPDATED: "text-red-400",
  VERIFICATION_ASSIGNED: "text-blue-400",
  APPLICATION_UPDATED: "text-emerald-400",
};

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const isSignedIn = !!getAccessToken();

  const refreshCount = useCallback(() => {
    if (!isSignedIn) return;
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 60000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Increment count on WS notification events
  useEffect(() => {
    const handler = () => setUnreadCount((c) => c + 1);
    window.addEventListener("unitycare:incident-created", handler as EventListener);
    window.addEventListener("unitycare:mission-assigned", handler as EventListener);
    return () => {
      window.removeEventListener("unitycare:incident-created", handler as EventListener);
      window.removeEventListener("unitycare:mission-assigned", handler as EventListener);
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getNotifications({ perPage: 30 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silent
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silent
    } finally {
      setMarkingAll(false);
    }
  };

  if (!isSignedIn) return null;

  return (
    <>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm h-full bg-gray-900 border-l border-gray-800 shadow-[-4px_0_20px_rgba(0,0,0,0.5)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                <span className="text-white text-sm font-bold tracking-wide">NOTIFICATIONS</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="flex items-center gap-1 px-2 py-1 rounded text-white/50 hover:text-white text-xs font-medium transition-colors"
                  >
                    {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    Read all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Bell className="w-8 h-8 text-white/15" />
                  <p className="text-white/40 text-sm">No notifications yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {notifications.map((n) => {
                    const Icon = TYPE_ICONS[n.type] ?? Bell;
                    const iconColor = TYPE_COLORS[n.type] ?? "text-white/40";

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => !n.isRead && handleMarkRead(n.id)}
                        className={`w-full text-left px-5 py-3.5 transition-colors ${
                          n.isRead
                            ? "opacity-60"
                            : "bg-red-500/5 hover:bg-red-500/10"
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.isRead ? "bg-gray-800" : "bg-gray-800/80"}`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium truncate ${n.isRead ? "text-white/60" : "text-white"}`}>
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-white/40 text-xs mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-white/30 text-[10px] mt-1">
                              {formatTimeAgo(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

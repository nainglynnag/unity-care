import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";
import {
  listAssignedMissions,
  type AssignedMission,
} from "@/lib/missions";

const STATUS_STYLES: Record<string, string> = {
  CREATED: "bg-gray-500/20 text-gray-400",
  ASSIGNED: "bg-blue-500/20 text-blue-400",
  ACCEPTED: "bg-emerald-500/20 text-emerald-400",
  EN_ROUTE: "bg-amber-500/20 text-amber-400",
  ON_SITE: "bg-amber-500/20 text-amber-400",
  IN_PROGRESS: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
  CLOSED: "bg-emerald-500/20 text-emerald-400",
  FAILED: "bg-red-500/20 text-red-400",
  CANCELLED: "bg-gray-600/30 text-gray-400",
};

const STATUS_ICONS: Record<string, typeof Shield> = {
  ACCEPTED: CheckCircle2,
  COMPLETED: CheckCircle2,
  CLOSED: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: XCircle,
};

function priorityDot(priority: string) {
  switch (priority) {
    case "CRITICAL": return "bg-red-500";
    case "HIGH": return "bg-red-400";
    case "MEDIUM": return "bg-amber-400";
    default: return "bg-blue-400";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(acceptedAt: string | null, completedAt: string | null) {
  if (!acceptedAt) return null;
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const start = new Date(acceptedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const diffMs = Math.max(0, end - start);
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "CREATED", label: "Created" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "EN_ROUTE", label: "En Route" },
  { value: "ON_SITE", label: "On Site" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CLOSED", label: "Closed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function VolunteerMissionHistory() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<AssignedMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAssignedMissions({
        status: statusFilter || undefined,
        page,
        perPage: 10,
      });
      setMissions(result.missions);
      setTotalPages(result.totalPages);
      setTotalRecords(result.totalRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load missions");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  // Auto-refresh when mission events arrive (e.g. accept from nearby incidents, WebSocket, etc.)
  useEffect(() => {
    const handler = () => fetchMissions();
    const events = [
      "unitycare:missions-changed",
      "unitycare:mission-assigned",
      "unitycare:mission-accepted",
      "unitycare:mission-completed",
      "unitycare:mission-closed",
      "unitycare:mission-failed",
    ];
    for (const evt of events) {
      window.addEventListener(evt, handler as EventListener);
    }
    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, handler as EventListener);
      }
    };
  }, [fetchMissions]);

  // Refetch from backend when page becomes visible (tab focus) so status stays in sync with DB
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fetchMissions();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchMissions]);

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "bg-red-500/20 text-red-500"
                : "bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-white/40 text-xs">
          {totalRecords} mission{totalRecords !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading && missions.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
          <button type="button" onClick={fetchMissions} className="text-red-500 text-xs hover:underline">
            Retry
          </button>
        </div>
      ) : missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Shield className="w-8 h-8 text-white/20" />
          <p className="text-white/50 text-sm">No missions found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {missions.map((m) => {
            const StatusIcon = STATUS_ICONS[m.status] ?? Shield;
            const duration = formatDuration(m.acceptedAt, m.completedAt);
            const isActive = ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"].includes(m.status);

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/volunteer-dashboard/missions?id=${m.id}`)}
                className="w-full text-left p-4 rounded-xl bg-gray-800/80 border border-gray-800 hover:border-gray-700 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-amber-500/20" : "bg-gray-700/50"}`}>
                    <StatusIcon className={`w-5 h-5 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate group-hover:text-red-400 transition-colors">
                          {m.primaryIncident.title}
                        </p>
                        <p className="text-white/50 text-xs mt-0.5">
                          {m.missionType}
                          {m.agency ? ` · ${m.agency.name}` : ""}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLES[m.status] ?? "bg-gray-600/30 text-gray-400"}`}>
                        {m.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-white/40 text-xs">
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${priorityDot(m.priority)}`} />
                        {m.priority}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(m.createdAt)}
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {duration}
                        </span>
                      )}
                      {m.closedAt && (
                        <span className="text-white/40">Closed {formatDate(m.closedAt)}</span>
                      )}
                      {m.primaryIncident.addressText && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {m.primaryIncident.addressText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

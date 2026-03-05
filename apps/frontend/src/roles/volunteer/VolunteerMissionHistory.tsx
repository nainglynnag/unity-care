import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
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
  History,
  Lock,
} from "lucide-react";
import {
  listAssignedMissions,
  listMissions,
  type AssignedMission,
} from "@/lib/missions";
import { getMyAgencyMembership } from "@/lib/agencyTeam";

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
  const [useAgencyList, setUseAgencyList] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    getMyAgencyMembership().then((m) => {
      setAgencyId(m?.agencyId ?? null);
      setMyRole(m?.myRole ?? null);
      // Only COORDINATOR/DIRECTOR can call listMissions(agencyId); MEMBER uses listAssignedMissions
      setUseAgencyList(!!m && m.myRole !== "MEMBER");
    });
  }, []);

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = useAgencyList && agencyId
        ? await listMissions({
            agencyId,
            status: statusFilter || undefined,
            page,
            perPage: 10,
          })
        : await listAssignedMissions({
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
  }, [page, statusFilter, useAgencyList, agencyId]);

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

  if (myRole === "MEMBER") {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Lock className="w-10 h-10 text-white/30" />
          <p className="text-white/50 text-sm text-center max-w-md">
            Mission History is only available to Directors and Coordinators.
          </p>
          <Link
            to="/volunteer-dashboard"
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide flex items-center gap-2">
          <History className="w-7 h-7 text-red-500" />
          MISSION HISTORY
        </h1>
        <p className="text-white/50 text-sm mt-1">
          View past and current missions. Click a mission to open details.
        </p>
      </div>

      {/* Filters + count */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? "bg-red-500/20 text-red-500 border border-red-500/40"
                  : "bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <span className="text-white/40 text-xs font-medium">
            {totalRecords} mission{totalRecords !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
      {loading && missions.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl bg-gray-800/50 border border-gray-800 p-8">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-white/70 text-sm text-center">{error}</p>
          <button
            type="button"
            onClick={fetchMissions}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl bg-gray-800/50 border border-gray-800 p-8">
          <Shield className="w-12 h-12 text-white/20" />
          <p className="text-white/50 text-sm">No missions found.</p>
          <p className="text-white/40 text-xs">Try changing the status filter or check back later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => {
            const StatusIcon = STATUS_ICONS[m.status] ?? Shield;
            const duration = formatDuration(m.acceptedAt, m.completedAt);
            const isActive = ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"].includes(m.status);

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/volunteer-dashboard/missions?id=${m.id}`)}
                className="w-full text-left p-5 rounded-xl bg-gray-800/80 border border-gray-800 hover:border-red-500/30 hover:bg-gray-800 transition-all duration-200 group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? "bg-amber-500/20 border border-amber-500/30" : "bg-gray-700/50 border border-gray-700"
                    }`}
                  >
                    <StatusIcon className={`w-6 h-6 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate group-hover:text-red-400 transition-colors">
                          {m.primaryIncident.title}
                        </p>
                        <p className="text-white/50 text-xs mt-0.5">
                          {m.missionType}
                          {m.agency ? ` · ${m.agency.name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          STATUS_STYLES[m.status] ?? "bg-gray-600/30 text-gray-400"
                        }`}
                      >
                        {m.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-white/45 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priorityDot(m.priority)}`} />
                        {m.priority}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-white/30" />
                        {formatDate(m.createdAt)}
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-white/30" />
                          {duration}
                        </span>
                      )}
                      {m.closedAt && (
                        <span className="text-white/40">Closed {formatDate(m.closedAt)}</span>
                      )}
                    </div>
                    {m.primaryIncident.addressText && (
                      <div className="flex items-center gap-1.5 mt-2 text-white/40 text-xs truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500/60" />
                        <span className="truncate">{m.primaryIncident.addressText}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-red-500 shrink-0 mt-0.5 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2.5 rounded-lg bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white/60 text-sm font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2.5 rounded-lg bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

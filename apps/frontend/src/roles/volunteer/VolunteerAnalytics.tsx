import { useState, useEffect } from "react";
import { getVolunteerMissionsDashboard, getVolunteerVerificationsDashboard } from "../../lib/dashboard";
import toast from "react-hot-toast";
import { Loader2, Radio, ShieldCheck, RefreshCw, AlertTriangle, Download } from "lucide-react";

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

const TAB_CONFIG = [
  { id: "missions" as const, label: "Missions", icon: Radio, fetcher: getVolunteerMissionsDashboard },
  { id: "verifications" as const, label: "Verifications", icon: ShieldCheck, fetcher: getVolunteerVerificationsDashboard },
];

// API response types (match backend volunteer dashboard)
type MissionsData = {
  period?: string;
  byType?: { type: string; total: number; closed: number; failed: number; successRate: number }[];
  byPriority?: { priority: string; count: number }[];
  recentMissions?: {
    missionId: string;
    status: string;
    missionType: string;
    priority: string;
    incidentTitle: string | null;
    category: string | null;
    acceptedAt: string | null;
    completedAt: string | null;
    assignedAt: string | null;
  }[];
};

type VerificationsData = {
  period?: string;
  total?: number;
  submitted?: number;
  accuracyRate?: number;
  avgResponseHours?: number;
  byDecision?: { VERIFIED?: number; UNREACHABLE?: number; FALSE_REPORT?: number; pending?: number };
  recentVerifications?: {
    id: string;
    decision: string | null;
    isConfirmed: boolean | null;
    incidentTitle: string;
    category: string | null;
    assignedAt: string | null;
    submittedAt: string | null;
  }[];
};

function formatPeriodLabel(value: string): string {
  return PERIODS.find((p) => p.value === value)?.label ?? value;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "short" });
}

function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.join(",");
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Key metrics summary strip
function KeyMetricsStrip({
  data,
  tab,
  period,
}: {
  data: MissionsData | VerificationsData | null;
  tab: "missions" | "verifications";
  period: string;
}) {
  if (!data) return null;

  const periodLabel = formatPeriodLabel(period);

  if (tab === "missions") {
    const missions = data as MissionsData;
    const byType = missions.byType ?? [];
    const totalMissions = byType.reduce((s, t) => s + t.total, 0);
    const totalClosed = byType.reduce((s, t) => s + t.closed, 0);
    const totalFailed = byType.reduce((s, t) => s + t.failed, 0);
    const successRate =
      totalClosed + totalFailed > 0
        ? Math.round((totalClosed / (totalClosed + totalFailed)) * 1000) / 10
        : 0;

    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 px-4 rounded-xl bg-gray-800/60 border border-gray-700/50 text-sm">
        <span className="text-white/90 font-medium">
          <span className="text-white">{totalMissions}</span> missions
        </span>
        <span className="text-white/50">·</span>
        <span className="text-white/90">
          <span className="text-emerald-400 font-semibold">{successRate}%</span> success rate
        </span>
        <span className="text-white/50">·</span>
        <span className="text-white/60">in {periodLabel}</span>
      </div>
    );
  }

  const ver = data as VerificationsData;
  const total = ver.total ?? 0;
  const submitted = ver.submitted ?? 0;
  const accuracy = ver.accuracyRate ?? 0;
  const avgHours = ver.avgResponseHours ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 px-4 rounded-xl bg-gray-800/60 border border-gray-700/50 text-sm">
      <span className="text-white/90 font-medium">
        <span className="text-white">{total}</span> assigned
      </span>
      <span className="text-white/50">·</span>
      <span className="text-white/90">
        <span className="text-white">{submitted}</span> submitted
      </span>
      <span className="text-white/50">·</span>
      <span className="text-white/90">
        <span className="text-emerald-400 font-semibold">{accuracy}%</span> accuracy
      </span>
      <span className="text-white/50">·</span>
      <span className="text-white/90">
        <span className="text-white">{avgHours}h</span> avg response
      </span>
      <span className="text-white/50">·</span>
      <span className="text-white/60">in {periodLabel}</span>
    </div>
  );
}

// Simple CSS bar chart
function BarChart({
  title,
  items,
  maxValue,
  colorClass = "bg-red-500/60",
}: {
  title: string;
  items: { label: string; value: number }[];
  maxValue?: number;
  colorClass?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) return null;

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <p className="text-white/80 text-sm font-semibold tracking-wider mb-4">{title}</p>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className="shrink-0 w-24 text-xs font-medium text-white/80 px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600/50 flex items-center justify-center truncate"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="flex-1 min-w-0 h-7 rounded-md bg-gray-700/50 overflow-hidden">
              <div
                className={`h-full rounded-md ${colorClass} transition-all duration-500 min-w-[2px]`}
                style={{ width: `${max ? (item.value / max) * 100 : 0}%` }}
              />
            </div>
            <span className="text-white font-semibold text-sm tabular-nums w-8 text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      {total > 0 && (
        <p className="text-white/40 text-xs mt-3">Total: {total}</p>
      )}
    </div>
  );
}

// Recent missions table with export
function RecentMissionsTable({ rows, period }: { rows: MissionsData["recentMissions"]; period: string }) {
  const list = rows ?? [];
  if (list.length === 0) return null;

  const columns = ["incidentTitle", "missionType", "priority", "status", "assignedAt", "completedAt"] as const;
  const exportRows = list.map((r) => ({
    incidentTitle: r.incidentTitle ?? "",
    missionType: r.missionType,
    priority: r.priority,
    status: r.status,
    assignedAt: r.assignedAt ?? "",
    completedAt: r.completedAt ?? "",
  }));

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between gap-2">
        <p className="text-white/80 text-sm font-semibold">Recent missions</p>
        <button
          type="button"
          onClick={() => downloadCsv(`missions-${period}-${Date.now()}.csv`, exportRows, [...columns])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-gray-700/50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Incident</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Priority</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Assigned</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Completed</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={row.missionId ?? i} className="border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors">
                <td className="px-5 py-3 text-white/90 max-w-[180px] truncate" title={row.incidentTitle ?? undefined}>
                  {row.incidentTitle ?? "—"}
                </td>
                <td className="px-5 py-3 text-white/80">{row.missionType ?? "—"}</td>
                <td className="px-5 py-3 text-white/80">{row.priority ?? "—"}</td>
                <td className="px-5 py-3 text-white/80">{row.status ?? "—"}</td>
                <td className="px-5 py-3 text-white/70">{formatDate(row.assignedAt)}</td>
                <td className="px-5 py-3 text-white/70">{formatDate(row.completedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Recent verifications table with export
function RecentVerificationsTable({
  rows,
  period,
}: {
  rows: VerificationsData["recentVerifications"];
  period: string;
}) {
  const list = rows ?? [];
  if (list.length === 0) return null;

  const columns = ["incidentTitle", "category", "decision", "isConfirmed", "assignedAt", "submittedAt"] as const;
  const exportRows = list.map((r) => ({
    incidentTitle: r.incidentTitle,
    category: r.category ?? "",
    decision: r.decision ?? "",
    isConfirmed: r.isConfirmed === true ? "Yes" : r.isConfirmed === false ? "No" : "",
    assignedAt: r.assignedAt ?? "",
    submittedAt: r.submittedAt ?? "",
  }));

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between gap-2">
        <p className="text-white/80 text-sm font-semibold">Recent verifications</p>
        <button
          type="button"
          onClick={() => downloadCsv(`verifications-${period}-${Date.now()}.csv`, exportRows, [...columns])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-gray-700/50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Incident</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Category</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Decision</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Confirmed</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Assigned</th>
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={row.id ?? i} className="border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors">
                <td className="px-5 py-3 text-white/90 max-w-[180px] truncate" title={row.incidentTitle}>
                  {row.incidentTitle}
                </td>
                <td className="px-5 py-3 text-white/80">{row.category ?? "—"}</td>
                <td className="px-5 py-3 text-white/80">{row.decision ?? "Pending"}</td>
                <td className="px-5 py-3 text-white/80">
                  {row.isConfirmed === true ? "Yes" : row.isConfirmed === false ? "No" : "—"}
                </td>
                <td className="px-5 py-3 text-white/70">{formatDate(row.assignedAt)}</td>
                <td className="px-5 py-3 text-white/70">{formatDate(row.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Priority breakdown (missions) – bar list, labels neutral and centered
function PriorityBreakdown({ byPriority }: { byPriority: MissionsData["byPriority"] }) {
  const list = byPriority ?? [];
  if (list.length === 0) return null;

  const maxCount = Math.max(...list.map((i) => i.count), 1);

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <p className="text-white/80 text-sm font-semibold tracking-wider mb-4">By priority</p>
      <div className="space-y-3">
        {list.map((item, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-gray-700/50 pb-3">
            <span className="shrink-0 w-24 text-xs font-medium text-white/80 px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600/50 flex items-center justify-center">
              {item.priority}
            </span>
            <div className="flex-1 min-w-0 h-7 rounded-md bg-gray-700/50 overflow-hidden">
              <div
                className="h-full rounded-md bg-red-500/60 min-w-[2px] transition-all duration-500"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-white font-semibold text-sm tabular-nums w-8 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VolunteerAnalytics() {
  const [activeTab, setActiveTab] = useState<"missions" | "verifications">("missions");
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = TAB_CONFIG.find((t) => t.id === activeTab)!;
  const fetcher = config.fetcher;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetcher(period)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load data";
        setError(msg);
        setData(null);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [activeTab, period, fetcher]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetcher(period)
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load data";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  const TabIcon = config.icon;
  const typedData = data as MissionsData | VerificationsData | null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black tracking-wide">ANALYTICS</h1>
          <p className="text-white/50 text-sm mt-1">Missions breakdown and verification performance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-gray-700/50 bg-gray-800/80 p-0.5">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-red-500/20 text-red-400"
                      : "text-white/60 hover:text-white hover:bg-gray-700/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700/50 text-white/70 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-red-500" />
          <p className="text-white/50 text-sm">Loading {config.label}…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-white/60 text-sm text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : data !== null ? (
        <div className="space-y-6">
          <KeyMetricsStrip data={typedData} tab={activeTab} period={period} />

          {activeTab === "missions" && typedData && "byType" in typedData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChart
                  title="Missions by type"
                  items={(typedData as MissionsData).byType?.map((t) => ({
                    label: t.type,
                    value: t.total,
                  })) ?? []}
                  colorClass="bg-red-500/60"
                />
                <PriorityBreakdown byPriority={(typedData as MissionsData).byPriority} />
              </div>
              <RecentMissionsTable
                rows={(typedData as MissionsData).recentMissions}
                period={period}
              />
            </>
          )}

          {activeTab === "verifications" && typedData && "byDecision" in typedData && (
            <>
              <BarChart
                title="Verifications by decision"
                items={Object.entries((typedData as VerificationsData).byDecision ?? {}).map(([label, value]) => ({
                  label: label === "pending" ? "Pending" : label.replace(/_/g, " "),
                  value: value ?? 0,
                }))}
                colorClass="bg-amber-500/60"
              />
              <RecentVerificationsTable
                rows={(typedData as VerificationsData).recentVerifications}
                period={period}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <TabIcon className="w-10 h-10 text-white/30" />
          <p className="text-white/50 text-sm">No data available for this period</p>
        </div>
      )}
    </div>
  );
}

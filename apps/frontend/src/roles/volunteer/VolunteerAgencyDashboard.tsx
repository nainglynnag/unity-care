import { useState, useEffect } from "react";
import {
  getAgencyLive,
  getAgencyIncidentsDashboard,
  getAgencyMissionsDashboard,
  getAgencyVolunteersDashboard,
  getAgencyCategoriesDashboard,
  getAgencyApplicationsDashboard,
} from "../../lib/dashboard";
import { getMyAgencyMembership, type AgencyMembership } from "../../lib/agencyTeam";
import toast from "react-hot-toast";
import {
  Loader2,
  Radio,
  AlertTriangle,
  Users,
  Layers,
  FileCheck,
  Activity,
  RefreshCw,
  Lock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

const TAB_CONFIG_BASE = [
  { id: "live" as const, label: "Live", icon: Radio, fetcher: getAgencyLive, requiresPeriod: false },
  {
    id: "incidents" as const,
    label: "Incidents",
    icon: AlertTriangle,
    fetcher: getAgencyIncidentsDashboard,
    requiresPeriod: true,
  },
  {
    id: "missions" as const,
    label: "Missions",
    icon: Activity,
    fetcher: getAgencyMissionsDashboard,
    requiresPeriod: true,
  },
  {
    id: "volunteers" as const,
    label: "Volunteers",
    icon: Users,
    fetcher: getAgencyVolunteersDashboard,
    requiresPeriod: true,
  },
  {
    id: "categories" as const,
    label: "Categories",
    icon: Layers,
    fetcher: getAgencyCategoriesDashboard,
    requiresPeriod: true,
  },
  {
    id: "applications" as const,
    label: "Applications",
    icon: FileCheck,
    fetcher: getAgencyApplicationsDashboard,
    requiresPeriod: true,
    directorOnly: true,
  },
];

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

function isDeltaObject(val: unknown): val is { current: number; previous: number; delta?: number } {
  return (
    val !== null &&
    typeof val === "object" &&
    "current" in val &&
    "previous" in val &&
    typeof (val as { current: unknown }).current === "number" &&
    typeof (val as { previous: unknown }).previous === "number"
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <p className="text-white text-2xl font-bold">
        {typeof value === "number" ? value.toLocaleString() : String(value)}
      </p>
      <p className="text-white/50 text-xs font-semibold tracking-wider mt-1">{label}</p>
    </div>
  );
}

function DeltaCard({
  label,
  current,
  previous,
  delta,
}: {
  label: string;
  current: number;
  previous: number;
  delta?: number;
}) {
  const computedDelta = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  const changePercent = delta !== undefined ? delta : computedDelta;
  const positive = changePercent >= 0;

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/50 text-xs font-semibold tracking-wider">{label}</p>
        {changePercent !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {positive ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-white text-2xl font-bold">{current.toLocaleString()}</p>
      <p className="text-white/40 text-xs mt-0.5">vs {previous.toLocaleString()} previous</p>
    </div>
  );
}

function DataTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="px-5 py-3 border-b border-gray-700/50">
        <p className="text-white/80 text-sm font-semibold">{title}</p>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider"
                >
                  {formatLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-5 py-3 text-white/90">
                    {row[col] !== null && row[col] !== undefined
                      ? typeof row[col] === "object"
                        ? JSON.stringify(row[col])
                        : String(row[col])
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrimitiveListTable({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="px-5 py-3 border-b border-gray-700/50">
        <p className="text-white/80 text-sm font-semibold">{title}</p>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors">
                <td className="px-5 py-3 text-white/90">
                  {item !== null && item !== undefined ? String(item) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardSection({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;

  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const first = data[0];
    if (first !== null && typeof first === "object" && !Array.isArray(first)) {
      return <DataTable title="Data" rows={data as Record<string, unknown>[]} />;
    }
    return <PrimitiveListTable title="Data" items={data} />;
  }

  if (typeof data !== "object") return null;

  const entries = Object.entries(data as Record<string, unknown>);
  const statCards: React.ReactNode[] = [];
  const deltaCards: React.ReactNode[] = [];
  const tables: React.ReactNode[] = [];

  for (const [key, value] of entries) {
    const label = formatLabel(key);
    if (typeof value === "number") {
      statCards.push(<StatCard key={key} label={label} value={value} />);
    } else if (isDeltaObject(value)) {
      deltaCards.push(
        <DeltaCard
          key={key}
          label={label}
          current={value.current}
          previous={value.previous}
          delta={value.delta}
        />
      );
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        const first = value[0];
        if (first !== null && typeof first === "object" && !Array.isArray(first)) {
          tables.push(
            <DataTable key={key} title={label} rows={value as Record<string, unknown>[]} />
          );
        } else {
          tables.push(<PrimitiveListTable key={key} title={label} items={value} />);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {(statCards.length > 0 || deltaCards.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards}
          {deltaCards}
        </div>
      )}
      {tables.length > 0 && <div className="space-y-4">{tables}</div>}
    </div>
  );
}

export default function VolunteerAgencyDashboard() {
  const [membership, setMembership] = useState<AgencyMembership | null | "loading">("loading");
  const [activeTab, setActiveTab] = useState<
    "live" | "incidents" | "missions" | "volunteers" | "categories" | "applications"
  >("live");
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve visible tabs based on role
  const TAB_CONFIG =
    membership !== null &&
    membership !== "loading" &&
    membership.myRole === "DIRECTOR"
      ? TAB_CONFIG_BASE
      : TAB_CONFIG_BASE.filter((t) => !t.directorOnly);

  const config = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0];
  const fetcher = config.fetcher;
  const showPeriodSelector = config.requiresPeriod ?? true;

  // Fetch membership on mount
  useEffect(() => {
    getMyAgencyMembership()
      .then((m) => {
        setMembership(m);
        if (m && m.myRole !== "MEMBER") {
          setActiveTab((prev) => {
            // Ensure current tab is still in TAB_CONFIG when switching from director to coordinator
            const nextTabs =
              m.myRole === "DIRECTOR"
                ? TAB_CONFIG_BASE
                : TAB_CONFIG_BASE.filter((t) => !t.directorOnly);
            const ids = nextTabs.map((t) => t.id);
            return ids.includes(prev) ? prev : ids[0];
          });
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load membership";
        setMembership(null);
        toast.error(msg);
      });
  }, []);

  // Fetch tab data when membership is leadership and tab/period changes
  useEffect(() => {
    if (
      membership === null ||
      membership === "loading" ||
      membership.myRole === "MEMBER"
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    const fetchFn = config.requiresPeriod
      ? (fetcher as (p: string) => Promise<unknown>)(period)
      : (fetcher as () => Promise<unknown>)();

    fetchFn
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
  }, [membership, activeTab, period, config.requiresPeriod, fetcher]);

  const handleRetry = () => {
    if (!membership || membership === "loading" || membership.myRole === "MEMBER") return;
    setError(null);
    setLoading(true);
    const fetchFn = config.requiresPeriod
      ? (fetcher as (p: string) => Promise<unknown>)(period)
      : (fetcher as () => Promise<unknown>)();
    fetchFn
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load data";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  // Loading membership
  if (membership === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
        <p className="text-white/50 text-sm">Loading agency…</p>
      </div>
    );
  }

  // No membership
  if (membership === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-white/60 text-sm text-center max-w-md">
          You are not assigned to an agency. Contact your administrator to join an agency team.
        </p>
      </div>
    );
  }

  // Member (not coordinator/director) — access denied
  if (membership.myRole === "MEMBER") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Lock className="w-10 h-10 text-red-500" />
        <p className="text-white text-lg font-semibold">Access Denied</p>
        <p className="text-white/60 text-sm text-center max-w-md">
          Agency analytics are only available to Coordinators and Directors. Your current role is Member.
        </p>
      </div>
    );
  }

  const TabIcon = config.icon;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black tracking-wide">
            {membership.agencyName.toUpperCase()} — ANALYTICS
          </h1>
          <p className="text-white/50 text-sm mt-1">Live status, incidents, missions, volunteers, and applications</p>
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
            {showPeriodSelector && (
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
            )}
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
        <DashboardSection data={data} />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <TabIcon className="w-10 h-10 text-white/30" />
          <p className="text-white/50 text-sm">No data available</p>
        </div>
      )}
    </div>
  );
}

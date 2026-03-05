import { useState, useEffect } from "react";
import { getAdminRetention, getAdminHealth, getAdminAgencies, getAdminApplicationsDashboard } from "@/lib/dashboard";
import toast from "react-hot-toast";
import { Loader2, TrendingUp, Activity, Building2, FileCheck, RefreshCw, TrendingDown, AlertTriangle } from "lucide-react";

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

const TAB_CONFIG = [
  { id: "retention" as const, label: "Retention", icon: TrendingUp, fetcher: getAdminRetention },
  { id: "health" as const, label: "Health", icon: Activity, fetcher: getAdminHealth },
  { id: "agencies" as const, label: "Agencies", icon: Building2, fetcher: getAdminAgencies },
  { id: "applications" as const, label: "Applications", icon: FileCheck, fetcher: getAdminApplicationsDashboard },
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
      <p className="text-white text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : String(value)}</p>
      <p className="text-white/50 text-xs font-semibold tracking-wider mt-1">{label}</p>
    </div>
  );
}

function DeltaCard({ label, current, previous, delta }: { label: string; current: number; previous: number; delta?: number }) {
  const computedDelta = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  const changePercent = delta !== undefined ? delta : computedDelta;
  const positive = changePercent >= 0;

  return (
    <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/50 text-xs font-semibold tracking-wider">{label}</p>
        {changePercent !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
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
                <th key={col} className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">
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
              <th className="px-5 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">Value</th>
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
        <DeltaCard key={key} label={label} current={value.current} previous={value.previous} delta={value.delta} />
      );
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        const first = value[0];
        if (first !== null && typeof first === "object" && !Array.isArray(first)) {
          tables.push(<DataTable key={key} title={label} rows={value as Record<string, unknown>[]} />);
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

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState<"retention" | "health" | "agencies" | "applications">("retention");
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black tracking-wide">ANALYTICS</h1>
          <p className="text-white/50 text-sm mt-1">Retention, health, agencies comparison, and applications backlog</p>
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
                      ? "bg-blue-500/20 text-blue-400"
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
              className="bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
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
              className="p-2 rounded-lg bg-gray-800 border border-gray-700/50 text-white/70 hover:text-blue-400 hover:border-blue-500/30 disabled:opacity-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-white/50 text-sm">Loading {config.label}…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-white/60 text-sm text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-semibold transition-colors"
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

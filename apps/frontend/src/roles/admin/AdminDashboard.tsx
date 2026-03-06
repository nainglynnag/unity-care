import { useEffect, useState } from "react";
import {
  Users,
  AlertTriangle,
  Shield,
  UserCheck,
  Loader2,
  TrendingUp,
  TrendingDown,
  Building2,
  Target,
} from "lucide-react";
import { getAdminOverview, getAdminHealth, type AdminOverview } from "@/lib/admin";

const OVERVIEW_PERIOD = "30d";

function DeltaBadge({ changePercent }: { changePercent: number }) {
  if (changePercent === 0) return null;
  const positive = changePercent > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {positive ? "+" : ""}{changePercent}%
    </span>
  );
}

function StatCard({
  label,
  value,
  changePercent,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  changePercent: number;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <DeltaBadge changePercent={changePercent} />
      </div>
      <p className="text-white text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="text-white/50 text-xs font-semibold tracking-wider mt-1">{label}</p>
    </div>
  );
}

function StatCardStatic({
  label,
  value,
  suffix,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-white text-3xl font-bold">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix != null && <span className="text-lg text-white/70 ml-0.5">{suffix}</span>}
      </p>
      <p className="text-white/50 text-xs font-semibold tracking-wider mt-1">{label}</p>
    </div>
  );
}

// Simple CSS bar chart for registration trend
function RegistrationChart({
  items,
}: {
  items: { bucket: string; civilians: number; volunteers: number }[];
}) {
  const max = 20;
  const rows = items.slice(-max);
  const maxVal = Math.max(
    1,
    ...rows.map((r) => r.civilians + r.volunteers),
  );

  if (rows.length === 0) return null;

  const formatLabel = (bucket: string) => {
    try {
      const d = new Date(bucket);
      if (isNaN(d.getTime())) return bucket;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "2-digit" : undefined });
    } catch {
      return bucket;
    }
  };

  return (
    <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <p className="text-white/80 text-sm font-semibold tracking-wider mb-4">Registrations over time</p>
      <p className="text-white/50 text-xs mb-4">Civilians and volunteers by period</p>
      <div className="space-y-3">
        {rows.map((item, i) => {
          const total = item.civilians + item.volunteers;
          const pct = maxVal ? (total / maxVal) * 100 : 0;
          const civPct = total ? (item.civilians / total) * pct : 0;
          const volPct = total ? (item.volunteers / total) * pct : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="shrink-0 w-20 text-xs font-medium text-white/80 truncate" title={item.bucket}>
                {formatLabel(item.bucket)}
              </span>
              <div className="flex-1 min-w-0 h-7 rounded-md bg-gray-700/50 overflow-hidden flex">
                {item.civilians > 0 && (
                  <div
                    className="h-full bg-blue-500/70 transition-all duration-500 min-w-[2px]"
                    style={{ width: `${civPct}%` }}
                    title={`Civilians: ${item.civilians}`}
                  />
                )}
                {item.volunteers > 0 && (
                  <div
                    className="h-full bg-emerald-500/70 transition-all duration-500 min-w-[2px]"
                    style={{ width: `${volPct}%` }}
                    title={`Volunteers: ${item.volunteers}`}
                  />
                )}
              </div>
              <span className="text-white font-semibold text-sm tabular-nums w-10 text-right">
                {total}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-4 pt-3 border-t border-gray-700/50 text-xs text-white/60">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/70" /> Civilians</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Volunteers</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<{ registrationTrend: { bucket: string; civilians: number; volunteers: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHealth(null);
    getAdminOverview(OVERVIEW_PERIOD)
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview"))
      .finally(() => setLoading(false));
    getAdminHealth(OVERVIEW_PERIOD)
      .then((h) => setHealth({ registrationTrend: h.registrationTrend }))
      .catch(() => setHealth({ registrationTrend: [] }));
  }, [refreshKey]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">PLATFORM OVERVIEW</h1>
        <p className="text-white/50 text-sm mt-1">Monitor platform-wide KPIs and activity (last 30 days)</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
          <button type="button" onClick={() => setRefreshKey((k) => k + 1)} className="text-blue-400 text-xs hover:underline">
            Retry
          </button>
        </div>
      ) : overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="CIVILIANS"
              value={overview.civilians.current}
              changePercent={overview.civilians.changePercent}
              icon={Users}
              color="bg-blue-500/20 text-blue-400"
            />
            <StatCard
              label="INCIDENTS"
              value={overview.incidents.current}
              changePercent={overview.incidents.changePercent}
              icon={AlertTriangle}
              color="bg-amber-500/20 text-amber-400"
            />
            <StatCard
              label="MISSIONS"
              value={overview.missions.current}
              changePercent={overview.missions.changePercent}
              icon={Shield}
              color="bg-red-500/20 text-red-400"
            />
            <StatCard
              label="VOLUNTEERS"
              value={overview.volunteers.current}
              changePercent={overview.volunteers.changePercent}
              icon={UserCheck}
              color="bg-emerald-500/20 text-emerald-400"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatCardStatic
              label="AGENCIES"
              value={overview.totalAgencies}
              icon={Building2}
              color="bg-violet-500/20 text-violet-400"
            />
            <StatCardStatic
              label="MISSION SUCCESS RATE"
              value={overview.missionSuccessRate}
              suffix="%"
              icon={Target}
              color="bg-cyan-500/20 text-cyan-400"
            />
          </div>
          {health?.registrationTrend && health.registrationTrend.length > 0 && (
            <RegistrationChart items={health.registrationTrend} />
          )}
        </div>
      ) : null}
    </div>
  );
}

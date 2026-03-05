import { useEffect, useState } from "react";
import {
  Users,
  AlertTriangle,
  Shield,
  UserCheck,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getAdminOverview, type AdminOverview } from "@/lib/admin";

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

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

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAdminOverview(period)
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview"))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black tracking-wide">PLATFORM OVERVIEW</h1>
          <p className="text-white/50 text-sm mt-1">Monitor platform-wide KPIs and activity</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p.value
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
          <button type="button" onClick={() => setPeriod(period)} className="text-blue-400 text-xs hover:underline">
            Retry
          </button>
        </div>
      ) : overview ? (
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
      ) : null}
    </div>
  );
}

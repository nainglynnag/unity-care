import { useState, useEffect } from "react";
import {
  Clock,
  ClipboardCheck,
  Award,
  X,
  Flame,
  Stethoscope,
  MapPin,
  Tag,
  User,
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { VolunteerMapCard } from "@/components/volunteer/VolunteerMapCard";
import { NearbyIncidentsList } from "@/components/volunteer/NearbyIncidentsList";
import {
  getNearbyIncidents,
  getIncident,
  type NearbyIncident,
  type IncidentDetail,
} from "@/lib/incidents";
import { getVolunteerSummary, type VolunteerSummary } from "@/lib/dashboard";
import { getAccessToken, API_BASE, authFetch } from "@/lib/api";

export default function VolunteerDashboard() {
  const [elapsed, setElapsed] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyIncidents, setNearbyIncidents] = useState<NearbyIncident[]>([]);
  const [nearbyTotal, setNearbyTotal] = useState(0);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  const [summary, setSummary] = useState<VolunteerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLeadership, setIsLeadership] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_BASE}/auth/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const memberships = json?.data?.agencyMemberships as Array<{ role: string }> | undefined;
        if (!memberships?.length) { setIsLeadership(false); return; }
        setIsLeadership(memberships.some((m) => m.role === "COORDINATOR" || m.role === "DIRECTOR"));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedIncident(null);
    try {
      const detail = await getIncident(id);
      if (!detail) throw new Error("Incident not found.");
      setSelectedIncident(detail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedIncident(null);
    setDetailError(null);
  };

  useEffect(() => {
    if (!sessionActive) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [sessionActive]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported.");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
        setLocationLoading(false);
      },
      () => {
        setLocationError("Unable to get your location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Load incidents: geo-filtered when location available, latest reported otherwise.
  // Fires once location resolves OR immediately when location is denied/unavailable.
  useEffect(() => {
    if (locationLoading) return;

    let cancelled = false;
    setNearbyLoading(true);
    setNearbyError(null);

    const params: Parameters<typeof getNearbyIncidents>[0] = { perPage: 5 };
    if (userLocation) {
      params.lat = userLocation[0];
      params.lng = userLocation[1];
      params.radiusKm = 50;
    }

    getNearbyIncidents(params)
      .then((result) => {
        if (cancelled) return;
        setNearbyIncidents(result.incidents);
        setNearbyTotal(result.totalRecords);
      })
      .catch((err) => {
        if (cancelled) return;
        setNearbyError(
          err instanceof Error ? err.message : "Failed to load nearby incidents",
        );
      })
      .finally(() => {
        if (!cancelled) setNearbyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationLoading, userLocation]);

  // Fetch volunteer dashboard summary (real stats)
  useEffect(() => {
    if (!getAccessToken()) return;
    setSummaryLoading(true);
    getVolunteerSummary("30d")
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  // Refresh nearby incidents when a new incident is reported (WS signal)
  useEffect(() => {
    const handler = () => {
      const params: Parameters<typeof getNearbyIncidents>[0] = { perPage: 5 };
      if (userLocation) {
        params.lat = userLocation[0];
        params.lng = userLocation[1];
        params.radiusKm = 50;
      }
      getNearbyIncidents(params)
        .then((result) => {
          setNearbyIncidents(result.incidents);
          setNearbyTotal(result.totalRecords);
        })
        .catch(() => {
          // Silent on real-time refresh failure
        });
    };

    window.addEventListener("unitycare:incident-created", handler as EventListener);
    return () => {
      window.removeEventListener("unitycare:incident-created", handler as EventListener);
    };
  }, [userLocation]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top row: Mission time + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Mission Time */}
        <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <h2 className="text-white/70 text-xs font-semibold tracking-wider mb-3 text-shadow-down">
            ACTIVE MISSION TIME
          </h2>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-white">
              {formatTime(elapsed)}
            </span>
            <span className="text-white/60 text-sm">ELAPSED</span>
          </div>
          <button
            type="button"
            onClick={() => setSessionActive(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            TERMINATE SESSION
          </button>
        </div>

        <VolunteerMapCard
          userLocation={userLocation}
          locationLoading={locationLoading}
          locationError={locationError}
          onSetLocation={(lat, lng) => setUserLocation([lat, lng])}
          incidents={nearbyIncidents}
          onIncidentClick={(id) => openDetail(id)}
        />
      </div>

      {/* Bottom row: Nearby incidents + Mission stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nearby Incidents */}
        <div className="lg:col-span-2 bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-shadow-down">NEARBY INCIDENTS</h2>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-xs font-semibold">
                {nearbyLoading ? "LOADING..." : `${nearbyTotal} ACTIVE`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllIncidents(true)}
              className="text-red-500 hover:text-red-400 text-sm font-medium"
            >
              VIEW ALL →
            </button>
          </div>
          {nearbyError && (
            <p className="text-xs text-red-400 mb-2">{nearbyError}</p>
          )}
          <ul className="space-y-4">
            {nearbyIncidents.map((inc) => {
              const categoryName = inc.category?.name ?? "Incident";
              const Icon =
                categoryName.toLowerCase().includes("fire") ||
                categoryName.toLowerCase().includes("burn")
                  ? Flame
                  : Stethoscope;
              const iconColor =
                Icon === Flame ? "text-red-500" : "text-blue-400";

              return (
                <li
                  key={inc.id}
                  className="p-4 rounded-lg bg-gray-900/80 border border-gray-800"
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 ${iconColor}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">
                        {inc.title}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        {inc.addressText ??
                          (inc.category?.name
                            ? `Category: ${inc.category.name}`
                            : "Reported incident in your area.")}
                      </p>
                      <p className="text-white/50 text-xs mt-2">
                        {typeof inc.distanceKm === "number"
                          ? `${inc.distanceKm.toFixed(1)} km away`
                          : "Distance unknown"}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => openDetail(inc.id)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          VIEW DETAILS
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {!nearbyLoading && nearbyIncidents.length === 0 && !nearbyError && (
              <li className="text-xs text-white/60">
                No newly reported incidents near you right now.
              </li>
            )}
          </ul>
        </div>

        {/* Mission Stats */}
        <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <h2 className="text-red-500 text-sm font-semibold tracking-wider mb-4 text-shadow-down">
            MISSION STATS
          </h2>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ) : (
            <ul className="space-y-4">
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <ClipboardCheck className="w-4 h-4 text-white/60" />
                  <span>MISSIONS DONE</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">
                    {summary?.missions.breakdown.closed ?? 0}
                  </span>
                  {summary && summary.missions.delta !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${summary.missions.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {summary.missions.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(summary.missions.delta)}
                    </span>
                  )}
                </div>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4 text-white/60" />
                  <span>TOTAL HOURS</span>
                </div>
                <span className="text-white font-bold">
                  {summary?.hoursServed ?? 0}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Award className="w-4 h-4 text-white/60" />
                  <span>SUCCESS RATE</span>
                </div>
                <span className={`text-sm font-bold ${(summary?.successRate.current ?? 0) >= 80 ? "text-emerald-400" : (summary?.successRate.current ?? 0) >= 50 ? "text-amber-400" : "text-white/60"}`}>
                  {summary ? `${summary.successRate.current}%` : "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <ClipboardCheck className="w-4 h-4 text-white/60" />
                  <span>ACTIVE</span>
                </div>
                <span className="text-amber-400 font-bold">
                  {summary?.missions.breakdown.active ?? 0}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4 text-white/60" />
                  <span>AVG DURATION</span>
                </div>
                <span className="text-white/70 text-sm font-medium">
                  {summary?.avgMissionDurationHours
                    ? `${summary.avgMissionDurationHours}h`
                    : "—"}
                </span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* VIEW ALL Nearby Incidents Panel */}
      {showAllIncidents && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowAllIncidents(false)}>
          <div
            className="w-full max-w-md h-full bg-gray-900 border-l border-gray-800 shadow-[-4px_0_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <span className="text-white text-sm font-bold tracking-wide">ALL NEARBY INCIDENTS</span>
              <button
                type="button"
                onClick={() => setShowAllIncidents(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NearbyIncidentsList readOnly={!isLeadership} />
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail Overlay */}
      {(selectedIncident || detailLoading || detailError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeDetail}
              className="absolute top-4 right-4 p-1 rounded-lg text-white/60 hover:text-white hover:bg-gray-800 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              </div>
            )}

            {detailError && (
              <div className="p-8 text-center">
                <p className="text-red-400 text-sm">{detailError}</p>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="mt-4 text-xs text-white/60 hover:text-white"
                >
                  Close
                </button>
              </div>
            )}

            {selectedIncident && !detailLoading && (
              <>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-800">
                  <span
                    className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider mb-3 ${
                      selectedIncident.status === "REPORTED"
                        ? "bg-amber-500/20 text-amber-400"
                        : selectedIncident.status === "VERIFIED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : selectedIncident.status === "CLOSED"
                            ? "bg-gray-600/30 text-gray-400"
                            : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {selectedIncident.status.replace(/_/g, " ")}
                  </span>
                  <h2 className="text-white text-lg font-bold leading-snug">
                    {selectedIncident.title}
                  </h2>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Description */}
                  {selectedIncident.description && (
                    <div className="flex gap-3">
                      <FileText className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                      <p className="text-white/80 text-sm leading-relaxed">
                        {selectedIncident.description}
                      </p>
                    </div>
                  )}

                  {/* Category */}
                  <div className="flex gap-3 items-center">
                    <Tag className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="text-white/70 text-sm">
                      {selectedIncident.category?.name ?? "Uncategorized"}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex gap-3 items-start">
                    <MapPin className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                    <div>
                      {selectedIncident.addressText && (
                        <p className="text-white/70 text-sm">
                          {selectedIncident.addressText}
                        </p>
                      )}
                      <p className="text-white/50 text-xs">
                        {selectedIncident.latitude.toFixed(5)},{" "}
                        {selectedIncident.longitude.toFixed(5)}
                      </p>
                    </div>
                  </div>

                  {/* Reporter */}
                  {selectedIncident.reporter && (
                    <div className="flex gap-3 items-center">
                      <User className="w-4 h-4 text-white/40 shrink-0" />
                      <span className="text-white/70 text-sm">
                        Reported by{" "}
                        <span className="text-white font-medium">
                          {selectedIncident.reporter.name}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Media */}
                  {selectedIncident.media && selectedIncident.media.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                        Attached Media
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedIncident.media.map((m) =>
                          m.mediaType === "IMAGE" ? (
                            <img
                              key={m.id}
                              src={m.url}
                              alt="Incident media"
                              className="w-full h-20 object-cover rounded-lg border border-gray-700"
                            />
                          ) : (
                            <a
                              key={m.id}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center h-20 rounded-lg border border-gray-700 bg-gray-800 text-white/60 text-xs hover:text-white"
                            >
                              {m.mediaType}
                            </a>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Missions */}
                  {selectedIncident.missions &&
                    selectedIncident.missions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                          Missions ({selectedIncident.missions.length})
                        </p>
                        <ul className="space-y-1.5">
                          {selectedIncident.missions.map((mission) => (
                            <li
                              key={mission.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  mission.status === "COMPLETED" ||
                                  mission.status === "CLOSED"
                                    ? "bg-emerald-500"
                                    : mission.status === "FAILED" ||
                                        mission.status === "CANCELLED"
                                      ? "bg-red-500"
                                      : "bg-amber-400"
                                }`}
                              />
                              <span className="text-white/70">
                                {mission.missionType ?? "Mission"} —{" "}
                                {mission.status.replace(/_/g, " ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

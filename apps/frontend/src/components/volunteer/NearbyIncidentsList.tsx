import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Flame,
  Stethoscope,
  MapPin,
  Tag,
  User,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  getNearbyIncidents,
  getIncident,
  acceptIncidentForVerification,
  submitVerification,
  type NearbyIncident,
  type IncidentDetail,
} from "@/lib/incidents";
import { acceptMission, getAssignedMissions } from "@/lib/missions";
import toast from "react-hot-toast";

interface NearbyIncidentsListProps {
  className?: string;
  readOnly?: boolean;
}

export function NearbyIncidentsList({ className, readOnly = false }: NearbyIncidentsListProps) {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const [incidents, setIncidents] = useState<NearbyIncident[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDenyInput, setShowDenyInput] = useState(false);
  const [denyComment, setDenyComment] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const fetchIncidents = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof getNearbyIncidents>[0] = { perPage: 50 };
    if (userLocation) {
      params.lat = userLocation[0];
      params.lng = userLocation[1];
      params.radiusKm = 100;
    }
    getNearbyIncidents(params)
      .then((result) => {
        setIncidents(result.incidents);
        setTotalRecords(result.totalRecords);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load incidents"),
      )
      .finally(() => setLoading(false));
  }, [userLocation]);

  useEffect(() => {
    if (locationLoading) return;
    fetchIncidents();
  }, [locationLoading, fetchIncidents]);

  useEffect(() => {
    const handler = () => fetchIncidents();
    window.addEventListener("unitycare:incident-created", handler as EventListener);
    return () =>
      window.removeEventListener("unitycare:incident-created", handler as EventListener);
  }, [fetchIncidents]);

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
    setShowDenyInput(false);
    setDenyComment("");
  };

  const handleAccept = async () => {
    if (!selectedIncident || actionLoading) return;
    setActionLoading(true);
    try {
      // 1. If incident is REPORTED, volunteer can self-accept for verification (creates assignment)
      if (selectedIncident.status === "REPORTED") {
        await acceptIncidentForVerification(selectedIncident.id);
        toast.success(
          "Incident accepted for verification. Go to Validation to submit your result, or check Missions.",
        );
        closeDetail();
        fetchIncidents();
        window.dispatchEvent(
          new CustomEvent("unitycare:assigned-incidents-changed"),
        );
        window.dispatchEvent(new CustomEvent("unitycare:missions-changed"));
        navigate("/volunteer-dashboard/missions");
        return;
      }

      // 2. If already assigned (AWAITING_VERIFICATION), submit verification result
      if (selectedIncident.status === "AWAITING_VERIFICATION") {
        await submitVerification(selectedIncident.id, { decision: "VERIFIED" });
        toast.success("Verification submitted — awaiting coordinator confirmation");
        closeDetail();
        window.dispatchEvent(
          new CustomEvent("unitycare:assigned-incidents-changed"),
        );
        navigate("/volunteer-dashboard/validation");
        return;
      }

      // 3. If we have a pending mission for this incident, accept the mission
      const missions = await getAssignedMissions();
      const pending = missions.find(
        (m) =>
          m.status === "ASSIGNED" &&
          m.primaryIncident.id === selectedIncident.id,
      );
      if (pending) {
        await acceptMission(pending.id);
        toast.success("Mission accepted — redirecting");
        closeDetail();
        window.dispatchEvent(
          new CustomEvent("unitycare:mission-accepted", {
            detail: { missionId: pending.id },
          }),
        );
        window.dispatchEvent(new CustomEvent("unitycare:missions-changed"));
        navigate(`/volunteer-dashboard/missions?id=${pending.id}`);
        return;
      }

      toast.success("Redirecting to missions");
      closeDetail();
      navigate("/volunteer-dashboard/missions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedIncident || actionLoading) return;
    if (!showDenyInput) {
      setShowDenyInput(true);
      return;
    }
    if (denyComment.length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setActionLoading(true);
    try {
      await submitVerification(selectedIncident.id, {
        decision: "FALSE_REPORT",
        comment: denyComment,
      });
      toast.success("Incident denied");
      closeDetail();
      fetchIncidents();
    } catch {
      // If not assigned as verifier, just close
      toast.success("Incident dismissed");
      closeDetail();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white text-lg font-bold">Nearby Incidents</h2>
          <p className="text-white/50 text-xs mt-0.5">
            {loading
              ? "Loading..."
              : `${totalRecords} active incident${totalRecords !== 1 ? "s" : ""} reported`}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchIncidents}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white/70 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Incident list */}
      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {incidents.map((inc) => {
          const categoryName = inc.category?.name ?? "Incident";
          const Icon =
            categoryName.toLowerCase().includes("fire") ||
            categoryName.toLowerCase().includes("burn")
              ? Flame
              : Stethoscope;
          const iconColor = Icon === Flame ? "text-red-500" : "text-blue-400";

          return (
            <div
              key={inc.id}
              className="p-3 rounded-xl bg-gray-800/80 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
              onClick={() => openDetail(inc.id)}
            >
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 ${iconColor}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white font-medium text-sm truncate">
                      {inc.title}
                    </p>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase shrink-0">
                      {inc.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-white/40 text-xs">
                    <span>{inc.category?.name ?? "Uncategorized"}</span>
                    {typeof inc.distanceKm === "number" && (
                      <span>{inc.distanceKm.toFixed(1)} km</span>
                    )}
                  </div>
                  {inc.addressText && (
                    <div className="flex items-center gap-1 mt-1 text-white/30 text-xs truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {inc.addressText}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && incidents.length === 0 && !error && (
          <div className="py-10 text-center">
            <AlertTriangle className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/50 text-sm">No active incidents nearby.</p>
            <p className="text-white/30 text-xs mt-1">
              New reports will appear automatically.
            </p>
          </div>
        )}

        {loading && incidents.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        )}
      </div>

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

                <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {selectedIncident.description && (
                    <div className="flex gap-3">
                      <FileText className="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                      <p className="text-white/80 text-sm leading-relaxed">
                        {selectedIncident.description}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    <Tag className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="text-white/70 text-sm">
                      {selectedIncident.category?.name ?? "Uncategorized"}
                    </span>
                  </div>

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

                <div className="px-6 py-4 border-t border-gray-800 space-y-3">
                  {readOnly ? (
                    <p className="text-center text-white/40 text-xs py-1">
                      View only — Directors and Coordinators can accept missions
                    </p>
                  ) : (
                    <>
                      {showDenyInput && (
                        <textarea
                          className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[60px] focus:outline-none focus:border-red-500 placeholder:text-white/30"
                          placeholder="Reason for denial (min 5 characters)..."
                          value={denyComment}
                          onChange={(e) => setDenyComment(e.target.value)}
                        />
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleAccept}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={handleDeny}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Deny
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

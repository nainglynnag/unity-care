import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  MapPin,
  Clock,
  User,
  Loader2,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MarkerContent,
  MapPopup,
} from "@/components/user/mapcn";
import { NearbyIncidentsList } from "@/components/volunteer/NearbyIncidentsList";
import { CreateMissionModal } from "@/components/volunteer/CreateMissionModal";
import { API_BASE, authFetch } from "../../lib/api";
import {
  getAssignedIncidents,
  getNearbyIncidents,
  acceptIncidentForVerification,
  submitVerification,
  confirmVerification,
  retryVerification,
  getVerifications,
  type AssignedIncident,
  type NearbyIncident,
  type Verification,
} from "../../lib/incidents";
import toast from "react-hot-toast";

/** Returns the user's agency role so we can gate actions (not visibility). */
function useAgencyRole(): { loaded: boolean; isLeadership: boolean } {
  const [state, setState] = useState<{ loaded: boolean; isLeadership: boolean }>({ loaded: false, isLeadership: false });
  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_BASE}/auth/me`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const data = json?.data;
        const memberships = data?.agencyMemberships as Array<{ role: string }> | undefined;
        if (!memberships?.length) {
          setState({ loaded: true, isLeadership: false });
          return;
        }
        const hasLeadership = memberships.some((m) => m.role === "COORDINATOR" || m.role === "DIRECTOR");
        setState({ loaded: true, isLeadership: hasLeadership });
      })
      .catch(() => setState({ loaded: true, isLeadership: false }));
    return () => { cancelled = true; };
  }, []);
  return state;
}

const MAP_ZOOM_INCIDENT = 15;
const MAP_ZOOM_VOLUNTEER = 13;

export default function VolunteerValidation() {
  const navigate = useNavigate();
  const { isLeadership } = useAgencyRole();
  const [showIncidents, setShowIncidents] = useState(false);
  const [assignments, setAssignments] = useState<AssignedIncident[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [showVerifications, setShowVerifications] = useState(false);
  const [verificationsIncidentId, setVerificationsIncidentId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [showConfirmReject, setShowConfirmReject] = useState(false);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyIncidents, setNearbyIncidents] = useState<NearbyIncident[]>([]);
  const [selectedPinIncidentId, setSelectedPinIncidentId] = useState<string | null>(null);
  const [createMissionFor, setCreateMissionFor] = useState<{ id: string; title: string } | null>(null);

  const refreshAssignments = useCallback(() => {
    setAssignmentsError("");
    getAssignedIncidents()
      .then(setAssignments)
      .catch((err) => {
        setAssignmentsError(
          err instanceof Error
            ? err.message
            : "Failed to load validation assignments",
        );
      });
  }, []);

  // Fetch assigned incidents for this volunteer
  useEffect(() => {
    let cancelled = false;
    setLoadingAssignments(true);
    getAssignedIncidents()
      .then((data) => {
        if (!cancelled) setAssignments(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setAssignmentsError(
            err instanceof Error
              ? err.message
              : "Failed to load validation assignments",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignments(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When volunteer accepts a nearby incident, refresh assignments so validation view shows it
  useEffect(() => {
    const handler = () => refreshAssignments();
    window.addEventListener("unitycare:assigned-incidents-changed", handler);
    return () =>
      window.removeEventListener("unitycare:assigned-incidents-changed", handler);
  }, [refreshAssignments]);

  // Get volunteer's current position as a fallback map center
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // Fetch nearby incidents for map markers (all volunteers)
  useEffect(() => {
    if (locationLoading) return;
    let cancelled = false;
    const baseParams: { lat?: number; lng?: number; radiusKm?: number; perPage?: number } = { perPage: 50 };
    if (userLocation) {
      baseParams.lat = userLocation[0];
      baseParams.lng = userLocation[1];
      baseParams.radiusKm = 20;
    }
    Promise.all([
      getNearbyIncidents({ ...baseParams, status: "REPORTED" }),
      getNearbyIncidents({ ...baseParams, status: "VERIFIED" }),
    ])
      .then(([reported, verified]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: NearbyIncident[] = [];
        for (const inc of [...reported.incidents, ...verified.incidents]) {
          if (!seen.has(inc.id)) { seen.add(inc.id); merged.push(inc); }
        }
        setNearbyIncidents(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [locationLoading, userLocation]);

  // When a mission is assigned to this volunteer (after coordinator confirms
  // verification and creates a mission), auto-navigate to the missions page.
  useEffect(() => {
    const handler = () => {
      toast.success("Mission assigned — opening mission tracker");
      navigate("/volunteer-dashboard/missions");
    };
    window.addEventListener("unitycare:mission-assigned", handler as EventListener);
    return () => window.removeEventListener("unitycare:mission-assigned", handler as EventListener);
  }, [navigate]);

  const pendingAssignment = useMemo(
    () =>
      assignments.find(
        (a) =>
          a.decision == null &&
          a.submittedAt == null &&
          (a.incident.status === "AWAITING_VERIFICATION" ||
            a.incident.status === "REPORTED"),
      ) ?? null,
    [assignments],
  );

  const hasSubmittedPending = useMemo(
    () => assignments.some((a) => a.decision != null && a.submittedAt != null && a.isConfirmed == null),
    [assignments],
  );

  const incident = pendingAssignment?.incident ?? null;

  const mapCenter: [number, number] | null = incident
    ? [incident.longitude, incident.latitude]
    : userLocation
      ? [userLocation[1], userLocation[0]]
      : null;

  const mapZoom = incident ? MAP_ZOOM_INCIDENT : MAP_ZOOM_VOLUNTEER;

  const hasReport = !!incident;

  const selectedPinIncident = useMemo(() => {
    if (!selectedPinIncidentId) return null;
    if (incident?.id === selectedPinIncidentId) return { ...incident, isAssigned: true };
    const near = nearbyIncidents.find((n) => n.id === selectedPinIncidentId);
    return near ? { ...near, isAssigned: false } : null;
  }, [selectedPinIncidentId, incident, nearbyIncidents]);

  const formattedAddress =
    incident?.addressText || incident?.landmark || "Coordinates only location";

  const formatAssignedTime = (iso?: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  const handleAccept = async () => {
    if (!incident || !pendingAssignment || submitting) return;
    setSubmitting(true);
    try {
      await submitVerification(incident.id, { decision: "VERIFIED" });
      toast.success("Incident verified — awaiting coordinator confirmation");
      const data = await getAssignedIncidents();
      setAssignments(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!incident || !pendingAssignment || submitting) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (rejectComment.length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setSubmitting(true);
    try {
      await submitVerification(incident.id, {
        decision: "FALSE_REPORT",
        comment: rejectComment,
      });
      toast.success("Incident marked as false report");
      setShowRejectInput(false);
      setRejectComment("");
      const data = await getAssignedIncidents();
      setAssignments(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenVerifications = async (incidentId: string) => {
    setVerificationsIncidentId(incidentId);
    setShowVerifications(true);
    try {
      const data = await getVerifications(incidentId);
      setVerifications(data);
    } catch { setVerifications([]); }
  };

  const handleConfirmVerification = async (incidentId: string, confirmed: boolean) => {
    setConfirmingId(incidentId);
    try {
      await confirmVerification(incidentId, confirmed, confirmed ? undefined : confirmNote || undefined);
      toast.success(confirmed ? "Verification confirmed" : "Verification rejected");
      setShowConfirmReject(false);
      setConfirmNote("");
      refreshAssignments();
      if (verificationsIncidentId) handleOpenVerifications(verificationsIncidentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setConfirmingId(null); }
  };

  const handleRetryVerification = async (incidentId: string, volunteerId: string) => {
    try {
      await retryVerification(incidentId, volunteerId);
      toast.success("Verification re-assigned");
      refreshAssignments();
      if (verificationsIncidentId) handleOpenVerifications(verificationsIncidentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    }
  };

  return (
    <div className="h-full">
      {/* Verification history modal for leadership */}
      {showVerifications && verificationsIncidentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowVerifications(false)}>
          <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-bold">Verification History</h3>
              <button type="button" onClick={() => setShowVerifications(false)} className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-gray-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-3">
              {verifications.length === 0 && <p className="text-white/50 text-sm">No verifications recorded.</p>}
              {verifications.map((v) => (
                <div key={v.id} className="p-3 rounded-xl bg-gray-800/80 border border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{v.volunteer.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      v.decision === "VERIFIED" ? "bg-emerald-500/20 text-emerald-400" :
                      v.decision === "FALSE_REPORT" ? "bg-red-500/20 text-red-400" :
                      v.decision === "UNREACHABLE" ? "bg-amber-500/20 text-amber-400" :
                      "bg-gray-600/30 text-gray-400"
                    }`}>
                      {v.decision ?? "PENDING"}
                    </span>
                  </div>
                  {v.comment && <p className="text-white/60 text-xs">{v.comment}</p>}
                  <div className="flex items-center gap-3 text-white/40 text-xs">
                    {v.assignedAt && <span>Assigned: {new Date(v.assignedAt).toLocaleString()}</span>}
                    {v.submittedAt && <span>Submitted: {new Date(v.submittedAt).toLocaleString()}</span>}
                  </div>
                  {v.isConfirmed != null && (
                    <span className={`text-xs font-bold ${v.isConfirmed ? "text-emerald-400" : "text-red-400"}`}>
                      {v.isConfirmed ? "Confirmed" : "Rejected by coordinator"}
                    </span>
                  )}
                  {isLeadership && v.decision && v.isConfirmed == null && (
                    <div className="flex gap-2 pt-1">
                      {!showConfirmReject ? (
                        <>
                          <button type="button" disabled={!!confirmingId} onClick={() => handleConfirmVerification(verificationsIncidentId, true)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold">
                            {confirmingId === verificationsIncidentId ? "..." : "Confirm"}
                          </button>
                          <button type="button" onClick={() => setShowConfirmReject(true)}
                            className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-700 text-white text-xs font-bold">
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="w-full space-y-2">
                          <textarea className="w-full rounded-lg bg-gray-950/70 border border-gray-700 text-white text-sm px-3 py-2 min-h-[40px] focus:outline-none focus:border-red-500 placeholder:text-white/30"
                            placeholder="Rejection note (min 5 chars)..." value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} />
                          <div className="flex gap-2">
                            <button type="button" disabled={confirmNote.length < 5 || !!confirmingId} onClick={() => handleConfirmVerification(verificationsIncidentId, false)}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold">Reject</button>
                            <button type="button" onClick={() => { setShowConfirmReject(false); setConfirmNote(""); }}
                              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold">Cancel</button>
                          </div>
                        </div>
                      )}
                      <button type="button" onClick={() => handleRetryVerification(verificationsIncidentId, v.volunteer.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-700 text-white text-xs font-bold">
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative h-full min-h-[480px]">
        {/* Full-width map as background */}
        <div className="absolute inset-0">
          {mapCenter ? (
            <>
            <MapcnMap
              theme="dark"
              className="h-full w-full"
              viewport={{
                center: mapCenter,
                zoom: mapZoom,
              }}
            >
              {/* Assigned incident marker (prominent, clickable) */}
              {incident && (
                <MapMarker
                  longitude={incident.longitude}
                  latitude={incident.latitude}
                >
                  <MarkerContent>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPinIncidentId((id) => (id === incident.id ? null : incident.id));
                      }}
                      className="flex flex-col items-center cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <div className="px-2 py-1 rounded bg-red-500 text-white text-xs font-semibold shadow-lg">
                        Reported location
                      </div>
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
                    </button>
                  </MarkerContent>
                </MapMarker>
              )}

              {/* Volunteer's own position */}
              {userLocation && (
                <MapMarker
                  longitude={userLocation[1]}
                  latitude={userLocation[0]}
                >
                  <MarkerContent>
                    <div className="relative">
                      <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                      <div className="absolute -inset-2 rounded-full bg-blue-500/20 animate-ping" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              )}

              {/* Nearby user-reported incidents (all volunteers can see) */}
              {nearbyIncidents.map((inc) => {
                if (inc.latitude == null || inc.longitude == null) return null;
                if (incident && inc.id === incident.id) return null;
                return (
                  <MapMarker
                    key={inc.id}
                    longitude={inc.longitude}
                    latitude={inc.latitude}
                  >
                    <MarkerContent>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPinIncidentId((id) => (id === inc.id ? null : inc.id));
                        }}
                        className="flex flex-col items-center group cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <div className="px-2 py-0.5 rounded bg-amber-500/90 text-white text-[10px] font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                          {inc.title}
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-lg group-hover:scale-125 transition-transform" />
                      </button>
                    </MarkerContent>
                  </MapMarker>
                );
              })}

              <MapControls
                position="bottom-right"
                showZoom
                showLocate
                onLocate={(coords) =>
                  setUserLocation([coords.latitude, coords.longitude])
                }
              />
              {/* Detail card at the pin */}
              {selectedPinIncident &&
                selectedPinIncident.latitude != null &&
                selectedPinIncident.longitude != null && (
                  <MapPopup
                    longitude={selectedPinIncident.longitude}
                    latitude={selectedPinIncident.latitude}
                    onClose={() => setSelectedPinIncidentId(null)}
                    closeButton
                    className="min-w-[260px] max-w-sm bg-gray-900/95 border border-gray-700 rounded-xl shadow-xl p-4 text-left text-popover-foreground"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedPinIncident.isAssigned ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                          {selectedPinIncident.isAssigned ? "Assigned" : "Reported"}
                        </span>
                        <span className="text-white/50 text-xs uppercase">{selectedPinIncident.status}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">{selectedPinIncident.title}</p>
                      {selectedPinIncident.category && (
                        <p className="text-white/60 text-xs">{selectedPinIncident.category.name}</p>
                      )}
                      {selectedPinIncident.addressText && (
                        <div className="flex items-start gap-2 text-white/70 text-xs">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                          <span>{selectedPinIncident.addressText}</span>
                        </div>
                      )}
                      {"description" in selectedPinIncident && selectedPinIncident.description && (
                        <p className="text-white/60 text-xs line-clamp-2">{selectedPinIncident.description}</p>
                      )}
                      {"distanceKm" in selectedPinIncident && selectedPinIncident.distanceKm != null && (
                        <p className="text-white/50 text-xs">{selectedPinIncident.distanceKm.toFixed(1)} km from you</p>
                      )}
                      {isLeadership && selectedPinIncident.status === "REPORTED" && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await acceptIncidentForVerification(selectedPinIncident.id);
                              toast.success("Incident accepted for verification");
                              setSelectedPinIncidentId(null);
                              window.dispatchEvent(new CustomEvent("unitycare:assigned-incidents-changed"));
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed to accept");
                            }
                          }}
                          className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          Accept for Verification
                        </button>
                      )}
                      {isLeadership && selectedPinIncident.status === "VERIFIED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCreateMissionFor({ id: selectedPinIncident.id, title: selectedPinIncident.title });
                            setSelectedPinIncidentId(null);
                          }}
                          className="w-full mt-2 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                        >
                          Create Mission
                        </button>
                      )}
                    </div>
                  </MapPopup>
                )}
            </MapcnMap>
            </>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900/90 text-white/60 text-sm gap-2">
              {loadingAssignments || locationLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <p>Preparing map and waiting for reports…</p>
                </>
              ) : assignmentsError ? (
                <p>{assignmentsError}</p>
              ) : locationError ? (
                <p>{locationError} Enable location to show map.</p>
              ) : hasSubmittedPending ? (
                <div className="text-center space-y-3">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-white/80 font-medium">Verification submitted</p>
                  <p className="text-white/50 text-xs max-w-xs">
                    {isLeadership ? "Review submitted verifications below." : "Awaiting coordinator confirmation. You'll be auto-redirected when a mission is assigned."}
                  </p>
                  {isLeadership && assignments.filter((a) => a.decision != null && a.isConfirmed == null).map((a) => (
                    <div key={a.verificationId} className="mt-2 mx-auto max-w-xs bg-gray-800/80 border border-gray-700 rounded-xl p-3 space-y-2 text-left">
                      <p className="text-white text-sm font-medium">{a.incident.title}</p>
                      <p className="text-white/60 text-xs">Decision: <span className="font-bold text-white/80">{a.decision}</span></p>
                      {a.comment && <p className="text-white/50 text-xs">{a.comment}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleConfirmVerification(a.incident.id, true)}
                          disabled={!!confirmingId} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold">Confirm</button>
                        <button type="button" onClick={() => handleOpenVerifications(a.incident.id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold">Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No active reports assigned for validation. Stand by on map.</p>
              )}
            </div>
          )}
        </div>

        {/* Overlays on top of the full map */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          {/* Top status bar */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-gray-800 bg-gradient-to-b from-gray-950/95 to-transparent pointer-events-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-500 text-xs font-semibold">
              {hasReport ? "VALIDATION MISSION" : "STANDBY MAP"}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-3 text-white/60 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  You
                </span>
                {hasReport && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    Assigned
                  </span>
                )}
                {nearbyIncidents.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    {nearbyIncidents.length} reported
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate("/volunteer-dashboard/missions")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-white/70 hover:text-white text-xs font-medium transition-colors"
              >
                Missions
              </button>
              <button
                type="button"
                onClick={() => setShowIncidents((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showIncidents
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-gray-800/90 hover:bg-gray-700 text-white/70 hover:text-white"
                }`}
              >
                Incidents
                {nearbyIncidents.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-400 text-[10px] font-bold">
                    {nearbyIncidents.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Left incident details card when a report exists */}
          {hasReport && incident && (
            <div className="mt-4 ml-4 mb-6 max-w-md bg-gray-900/95 border border-gray-800 rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.7)] space-y-6 pointer-events-auto">
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>REPORT AWAITING VALIDATION</span>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                    TYPE
                  </p>
                  <p className="text-white font-semibold text-sm">
                    {incident.category?.name ?? "Uncategorised incident"}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                      TITLE
                    </p>
                    <p className="text-white text-sm font-medium">
                      {incident.title}
                    </p>
                  </div>

                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                      LOCATION
                    </p>
                    <div className="bg-gray-950/70 rounded-lg border border-gray-800 px-3 py-2 space-y-1">
                      <div className="flex items-start gap-2 text-sm text-white/80">
                        <MapPin className="w-4 h-4 mt-0.5 text-red-400" />
                        <div>
                          <p className="font-medium">{formattedAddress}</p>
                          <p className="text-xs text-white/50 mt-0.5">
                            {incident.latitude.toFixed(5)},{" "}
                            {incident.longitude.toFixed(5)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {pendingAssignment?.assignedAt && (
                    <div>
                      <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                        ASSIGNED
                      </p>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Clock className="w-4 h-4 text-white/60" />
                        <span>
                          {formatAssignedTime(pendingAssignment.assignedAt)}
                        </span>
                      </div>
                    </div>
                  )}

                  {incident.reporter && (
                    <div>
                      <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                        REPORTED BY
                      </p>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <User className="w-4 h-4 text-white/60" />
                        <span>{incident.reporter.name}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reject comment input */}
              {showRejectInput && (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-lg bg-gray-950/70 border border-gray-700 text-white text-sm px-3 py-2 min-h-[60px] focus:outline-none focus:border-red-500 placeholder:text-white/30"
                    placeholder="Reason for rejection (min 5 characters)..."
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                  />
                </div>
              )}

              {/* Accept / Reject buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  ACCEPT
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  REJECT
                </button>
              </div>
            </div>
          )}

          {/* Right-side nearby incidents panel */}
          {showIncidents && (
            <div className="absolute top-0 right-0 h-full w-full max-w-sm bg-gray-900/95 border-l border-gray-800 shadow-[-4px_0_20px_rgba(0,0,0,0.5)] pointer-events-auto z-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-white text-sm font-semibold">Nearby Incidents</span>
                <button
                  type="button"
                  onClick={() => setShowIncidents(false)}
                  className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 h-[calc(100%-49px)] overflow-y-auto">
                <NearbyIncidentsList readOnly={!isLeadership} />
              </div>
            </div>
          )}
        </div>
      </div>

      {createMissionFor && (
        <CreateMissionModal
          incidentId={createMissionFor.id}
          incidentTitle={createMissionFor.title}
          onCreated={() => {
            setCreateMissionFor(null);
            toast.success("Mission created — volunteers have been assigned");
            refreshAssignments();
          }}
          onClose={() => setCreateMissionFor(null)}
        />
      )}
    </div>
  );
}


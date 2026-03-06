import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  Check,
  ChevronRight,
  FileText,
  Activity,
  Crosshair,
  Loader2,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import {
  Map as MapcnMap,
  MapMarker,
  MarkerContent,
  MapControls,
} from "@/components/user/mapcn";
import {
  getAssignedMissions,
  getMission,
  acceptMission,
  rejectMission,
  startTravel,
  arriveOnSite,
  startWork,
  submitCompletionReport,
  reportFailure,
  cancelMission,
  confirmCompletion,
  agencyDecision,
  pushTracking,
  getTrackingLatest,
  type MissionDetail,
  type MissionLog,
  type MissionAssignment,
  type MissionTrackingPoint,
} from "@/lib/missions";
import { getMyAgencyMembership, type AgencyRole } from "@/lib/agencyTeam";
import toast from "react-hot-toast";

const PHASES = [
  { id: "EN_ROUTE", label: "EN ROUTE" },
  { id: "AT_SCENE", label: "AT SCENE" },
  { id: "EXECUTING", label: "EXECUTING" },
  { id: "FINALIZING", label: "FINALIZING" },
] as const;

function statusToPhaseIndex(status: string): number {
  switch (status) {
    case "ACCEPTED":
    case "EN_ROUTE":
      return 0;
    case "ON_SITE":
      return 1;
    case "IN_PROGRESS":
      return 2;
    case "COMPLETED":
    case "CLOSED":
      return 3;
    default:
      return 0;
  }
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useCurrentLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);
  const refresh = useCallback(() => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("No geolocation"));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          resolve(loc);
        },
        () => reject(new Error("Location denied")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, []);
  return { location, refresh };
}

type CompletionReportData = {
  summary: string;
  actionsTaken?: string;
  resourcesUsed?: string;
  casualties?: number;
  propertyDamage?: string;
};

function CompletionModal({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (data: CompletionReportData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [resourcesUsed, setResourcesUsed] = useState("");
  const [casualties, setCasualties] = useState("");
  const [propertyDamage, setPropertyDamage] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4">
      <div className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4">
        <h3 className="text-white text-lg font-bold">Finish mission</h3>
        <p className="text-white/60 text-sm">Provide a brief summary and optional details (MissionReport).</p>
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Summary *</label>
          <textarea
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[80px] focus:outline-none focus:border-red-500"
            placeholder="Mission summary (min 10 characters)..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Actions taken</label>
          <textarea
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[60px] focus:outline-none focus:border-red-500"
            placeholder="Optional"
            value={actionsTaken}
            onChange={(e) => setActionsTaken(e.target.value)}
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Resources used</label>
          <input
            type="text"
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-500"
            placeholder="Optional"
            value={resourcesUsed}
            onChange={(e) => setResourcesUsed(e.target.value)}
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Casualties (number)</label>
          <input
            type="number"
            min={0}
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-500"
            placeholder="0"
            value={casualties}
            onChange={(e) => setCasualties(e.target.value)}
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Property damage</label>
          <input
            type="text"
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-500"
            placeholder="Optional"
            value={propertyDamage}
            onChange={(e) => setPropertyDamage(e.target.value)}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-gray-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const c = casualties === "" ? undefined : parseInt(casualties, 10);
              onSubmit({
                summary,
                actionsTaken: actionsTaken || undefined,
                resourcesUsed: resourcesUsed || undefined,
                casualties: c != null && !Number.isNaN(c) ? c : undefined,
                propertyDamage: propertyDamage || undefined,
              });
            }}
            disabled={submitting || summary.length < 10}
            className="px-6 py-2 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteModal({
  title,
  description,
  placeholder,
  confirmLabel,
  confirmColor,
  onSubmit,
  onCancel,
  submitting,
  minLength = 5,
}: {
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  confirmColor: string;
  onSubmit: (note: string) => void;
  onCancel: () => void;
  submitting: boolean;
  minLength?: number;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4">
        <h3 className="text-white text-lg font-bold">{title}</h3>
        <p className="text-white/60 text-sm">{description}</p>
        <textarea
          className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[80px] focus:outline-none focus:border-red-500 placeholder:text-white/30"
          placeholder={placeholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-gray-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(note.trim())}
            disabled={submitting || note.trim().length < minLength}
            className={`px-6 py-2 rounded-full ${confirmColor} disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VolunteerMissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const missionIdParam = searchParams.get("id");
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showRejectCompletion, setShowRejectCompletion] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const { location: userLocation, refresh: refreshLocation } = useCurrentLocation();
  const trackingRef = useRef<number | undefined>(undefined);
  const trackingPushInFlightRef = useRef(false);
  const trackingLastPushTimeRef = useRef<number>(0);
  const [latestTracking, setLatestTracking] = useState<MissionTrackingPoint[]>([]);
  const [myAgencyRole, setMyAgencyRole] = useState<AgencyRole | null>(null);

  useEffect(() => {
    getMyAgencyMembership().then((m) => {
      if (m) setMyAgencyRole(m.myRole);
    }).catch(() => {});
  }, []);

  const isLeadership = myAgencyRole === "DIRECTOR" || myAgencyRole === "COORDINATOR";
  const isMember = myAgencyRole === "MEMBER";

  const fetchMission = useCallback(async () => {
    try {
      if (missionIdParam) {
        const data = await getMission(missionIdParam);
        if (data) {
          setMission(data);
          setError(null);
          setLoading(false);
          return;
        }
      }
      const missions = await getAssignedMissions();
      const active = missions.find(
        (m) =>
          m.status !== "COMPLETED" &&
          m.status !== "CLOSED" &&
          m.status !== "FAILED" &&
          m.status !== "CANCELLED",
      );
      if (active) {
        const detail = await getMission(active.id);
        setMission(detail ?? null);
        if (!detail) setMission(active as MissionDetail);
      } else {
        setMission(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mission");
      setMission(null);
    } finally {
      setLoading(false);
    }
  }, [missionIdParam]);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  useEffect(() => {
    if (!mission) return;
    const id = setInterval(fetchMission, 15000);
    return () => clearInterval(id);
  }, [mission?.id, fetchMission]);

  useEffect(() => {
    const elapsedStart = mission?.acceptedAt ?? mission?.createdAt;
    if (!elapsedStart) return;
    const start = new Date(elapsedStart).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsed(
        `${String(Math.floor(diff / 3600)).padStart(2, "0")}:${String(Math.floor((diff % 3600) / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mission?.acceptedAt, mission?.createdAt]);

  useEffect(() => {
    if (!mission || !userLocation) return;
    const trackable = ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"];
    if (!trackable.includes(mission.status)) return;
    const MIN_TRACKING_INTERVAL_MS = 15_000;
    const push = () => {
      if (trackingPushInFlightRef.current) return;
      const now = Date.now();
      if (now - trackingLastPushTimeRef.current < MIN_TRACKING_INTERVAL_MS) return;
      trackingPushInFlightRef.current = true;
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          pushTracking(mission.id, pos.coords.latitude, pos.coords.longitude)
            .then(() => {
              trackingLastPushTimeRef.current = Date.now();
            })
            .catch(() => {})
            .finally(() => {
              trackingPushInFlightRef.current = false;
            });
        },
        () => {
          trackingPushInFlightRef.current = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    };
    trackingRef.current = window.setInterval(push, 15000);
    return () => {
      if (trackingRef.current) clearInterval(trackingRef.current);
    };
  }, [mission?.id, mission?.status, userLocation]);

  useEffect(() => {
    if (!mission) return;
    const trackable = ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"];
    if (!trackable.includes(mission.status)) return;
    let cancelled = false;
    const poll = () => {
      getTrackingLatest(mission.id).then((pts) => {
        if (!cancelled) setLatestTracking(pts);
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [mission?.id, mission?.status]);

  const handleReportFailure = async (reason: string) => {
    if (!mission) return;
    const loc = await refreshLocation().catch(() => userLocation);
    setActionLoading(true);
    try {
      await reportFailure(mission.id, reason, loc?.lat, loc?.lng);
      toast.success("Mission reported as failed");
      setShowFailure(false);
      navigate("/volunteer-dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (note: string) => {
    if (!mission) return;
    setActionLoading(true);
    try {
      await cancelMission(mission.id, note);
      toast.success("Mission cancelled");
      setShowCancel(false);
      navigate("/volunteer-dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCompletion = async (confirmed: boolean, note?: string) => {
    if (!mission) return;
    setActionLoading(true);
    try {
      await confirmCompletion(mission.id, confirmed, note);
      toast.success(confirmed ? "Mission completion confirmed — closed" : "Completion rejected — returned to volunteer");
      setShowRejectCompletion(false);
      await fetchMission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgencyDecision = async (decision: "CONTINUE" | "FAIL", note?: string) => {
    if (!mission) return;
    setActionLoading(true);
    try {
      await agencyDecision(mission.id, decision, undefined, note);
      toast.success(decision === "FAIL" ? "Mission marked as failed" : "Mission reassignment initiated");
      await fetchMission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!mission || actionLoading) return;
    setActionLoading(true);
    try {
      await acceptMission(mission.id);
      toast.success("Mission accepted");
      window.dispatchEvent(new CustomEvent("unitycare:mission-accepted", { detail: { missionId: mission.id } }));
      await fetchMission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!mission || actionLoading) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (rejectNote.trim().length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setActionLoading(true);
    try {
      await rejectMission(mission.id, rejectNote.trim());
      toast.success("Mission declined");
      setShowRejectInput(false);
      setRejectNote("");
      navigate("/volunteer-dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhaseAction = async () => {
    if (!mission || actionLoading) return;
    const loc = await refreshLocation().catch(() => userLocation);
    const lat = loc?.lat ?? 0;
    const lng = loc?.lng ?? 0;
    setActionLoading(true);
    try {
      switch (mission.status) {
        case "ACCEPTED":
          await startTravel(mission.id, lat, lng);
          toast.success("En route started");
          break;
        case "EN_ROUTE":
          await arriveOnSite(mission.id, lat, lng);
          toast.success("Arrived on site");
          break;
        case "ON_SITE":
          await startWork(mission.id, lat, lng);
          toast.success("Work started");
          break;
        case "IN_PROGRESS":
          setShowCompletion(true);
          setActionLoading(false);
          return;
        default:
          break;
      }
      await fetchMission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishMission = async (data: { summary: string; actionsTaken?: string; resourcesUsed?: string; casualties?: number; propertyDamage?: string }) => {
    if (!mission) return;
    const loc = await refreshLocation().catch(() => userLocation);
    setActionLoading(true);
    try {
      await submitCompletionReport(mission.id, {
        latitude: loc?.lat ?? 0,
        longitude: loc?.lng ?? 0,
        summary: data.summary,
        actionsTaken: data.actionsTaken,
        resourcesUsed: data.resourcesUsed,
        casualties: data.casualties,
        propertyDamage: data.propertyDamage,
      });
      toast.success("Completion report submitted");
      setShowCompletion(false);
      window.dispatchEvent(new CustomEvent("unitycare:mission-completed", { detail: { missionId: mission.id } }));
      await fetchMission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !mission) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (error && !mission) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-6">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-white/70 text-sm">{error}</p>
        <button type="button" onClick={() => { setLoading(true); fetchMission(); }} className="text-red-500 text-xs hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <h2 className="text-white font-bold text-lg">No active mission</h2>
          <p className="text-white/50 text-sm">View history or wait for a coordinator to assign you a mission.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => navigate("/volunteer-dashboard/mission-history")} className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium">
              View history
            </button>
            <button type="button" onClick={() => navigate("/volunteer-dashboard/validation")} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white/70 text-sm font-medium">
              Validation
            </button>
            <button type="button" onClick={() => navigate("/volunteer-dashboard")} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white/70 text-sm font-medium">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const incident = mission.primaryIncident;
  const logs: MissionLog[] = (mission.logs ?? []).slice().sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const phaseIndex = statusToPhaseIndex(mission.status);
  const isAssigned = mission.status === "ASSIGNED";
  const canAdvancePhase = ["ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"].includes(mission.status);
  const mapCenter: [number, number] =
    incident && incident.longitude != null && incident.latitude != null
      ? [incident.longitude, incident.latitude]
      : [-118.2437, 34.0522];
  const distanceKm =
    userLocation && incident && incident.latitude != null && incident.longitude != null
      ? haversineKm(userLocation.lat, userLocation.lng, incident.latitude, incident.longitude)
      : null;

  if (isAssigned) {
    return (
      <div className="h-full flex flex-col bg-gray-950 text-white">
        <div className="px-6 py-4 border-b border-gray-800">
          <h1 className="text-white text-xl font-black tracking-wide">NEW MISSION ASSIGNMENT</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-white font-bold text-sm">{incident?.title ?? "Mission"}</p>
                  <p className="text-white/50 text-xs">{incident?.category?.name ?? mission.missionType}</p>
                </div>
                <span className="ml-auto px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black">
                  {mission.priority}
                </span>
              </div>
              <div className="p-6 space-y-4">
                {incident?.description && (
                  <div>
                    <p className="text-white/40 text-[10px] font-bold tracking-widest mb-1">DESCRIPTION</p>
                    <p className="text-white/70 text-sm">{incident.description}</p>
                  </div>
                )}
                {incident?.addressText && (
                  <div>
                    <p className="text-white/40 text-[10px] font-bold tracking-widest mb-1">LOCATION</p>
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span>{incident.addressText}</span>
                    </div>
                  </div>
                )}
                {distanceKm != null && (
                  <p className="text-white/70 text-sm">{distanceKm.toFixed(1)} km from your location</p>
                )}
              </div>
              <div className="px-6 pb-6 space-y-3">
                {isMember ? (
                  <p className="text-white/40 text-xs text-center py-3">View only — accepting missions requires Coordinator or Director role.</p>
                ) : (
                  <>
                    {showRejectInput && (
                      <textarea
                        className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[60px] focus:outline-none focus:border-red-500"
                        placeholder="Reason for declining (min 5 characters)..."
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="flex-1 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-black flex items-center justify-center gap-2"
                      >
                        {actionLoading && !showRejectInput && <Loader2 className="w-4 h-4 animate-spin" />}
                        <Check className="w-4 h-4" />
                        ACCEPT MISSION
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="flex-1 py-3.5 rounded-full bg-red-600/80 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-black flex items-center justify-center gap-2"
                      >
                        {actionLoading && showRejectInput && <Loader2 className="w-4 h-4 animate-spin" />}
                        DECLINE
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tracking: MissionTrackingPoint[] = mission.tracking ?? [];
  const assignments: MissionAssignment[] = mission.assignments ?? [];
  const trackingPointsToShow = (() => {
    const list = latestTracking.length > 0 ? latestTracking : tracking.slice(-20);
    const byVolunteer = new Map<string, MissionTrackingPoint>();
    for (const t of list) {
      const vid = t.volunteer?.id ?? "unknown";
      const existing = byVolunteer.get(vid);
      if (!existing || new Date(t.recordedAt) > new Date(existing.recordedAt)) {
        byVolunteer.set(vid, t);
      }
    }
    return Array.from(byVolunteer.values());
  })();

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white">
      {showCompletion && (
        <CompletionModal
          onSubmit={handleFinishMission}
          onCancel={() => setShowCompletion(false)}
          submitting={actionLoading}
        />
      )}
      {showFailure && (
        <NoteModal
          title="Report mission failure"
          description="Explain why this mission cannot be completed."
          placeholder="Reason for failure (min 5 characters)..."
          confirmLabel="Report failure"
          confirmColor="bg-red-600 hover:bg-red-700"
          onSubmit={handleReportFailure}
          onCancel={() => setShowFailure(false)}
          submitting={actionLoading}
        />
      )}
      {showCancel && (
        <NoteModal
          title="Cancel mission"
          description="Provide a reason for cancelling this mission."
          placeholder="Cancellation reason (min 5 characters)..."
          confirmLabel="Cancel mission"
          confirmColor="bg-red-600 hover:bg-red-700"
          onSubmit={handleCancel}
          onCancel={() => setShowCancel(false)}
          submitting={actionLoading}
        />
      )}
      {showRejectCompletion && (
        <NoteModal
          title="Reject completion report"
          description="The mission will be returned to the volunteer for further action. Provide a reason."
          placeholder="Rejection reason (min 5 characters)..."
          confirmLabel="Reject report"
          confirmColor="bg-red-600 hover:bg-red-700"
          onSubmit={(note) => handleConfirmCompletion(false, note)}
          onCancel={() => setShowRejectCompletion(false)}
          submitting={actionLoading}
        />
      )}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80">
        <h1 className="text-white text-xl font-black tracking-wide">MISSION UPDATE</h1>
        <div className="text-right flex flex-col gap-0.5">
          <p className="text-white/50 text-[10px] font-semibold tracking-wider uppercase">Elapsed time</p>
          <p className="text-white font-mono font-bold text-lg tabular-nums">{elapsed}</p>
          {mission.status === "CLOSED" && mission.closedAt && (
            <p className="text-white/40 text-xs mt-1">Closed {new Date(mission.closedAt).toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
        <p className="text-white/50 text-xs font-semibold tracking-wider mb-2 uppercase">
          Operational phase: {PHASES[phaseIndex]?.label ?? mission.status}
        </p>
        <div className="flex items-center gap-0">
          {PHASES.map((phase, i) => {
            const done = i < phaseIndex;
            const active = i === phaseIndex;
            const isLast = i === PHASES.length - 1;
            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      done ? "bg-red-500 border-red-500 text-white" : active ? "border-red-500 bg-red-500/20 text-red-500" : "border-gray-600 bg-gray-800 text-gray-500"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : active ? <ChevronRight className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider ${done || active ? "text-red-500" : "text-gray-500"}`}>
                    {phase.label}
                  </span>
                </div>
                {!isLast && <div className="flex-1 mx-1 mb-5"><div className={`h-0.5 w-full ${done ? "bg-red-500" : "bg-gray-700"}`} /></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 lg:flex-row">
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
          <div className="flex-1 min-h-[240px] relative bg-gray-900">
            <MapcnMap theme="dark" className="h-full w-full" viewport={{ center: mapCenter, zoom: 14 }}>
              {incident && incident.latitude != null && incident.longitude != null && (
                <MapMarker longitude={incident.longitude} latitude={incident.latitude}>
                  <MarkerContent>
                    <div className="flex flex-col items-center">
                      <div className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold shadow-lg">Reported Location</div>
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              )}
              {userLocation && (
                <MapMarker longitude={userLocation.lng} latitude={userLocation.lat}>
                  <MarkerContent>
                    <div className="relative">
                      <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                      <div className="absolute -inset-2 rounded-full bg-blue-500/20 animate-ping" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              )}
              {trackingPointsToShow.map((t, i) => (
                <MapMarker key={`trk-${t.volunteer?.id ?? i}`} longitude={t.longitude} latitude={t.latitude}>
                  <MarkerContent>
                    <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow" title={t.volunteer?.name ?? "Teammate"} />
                  </MarkerContent>
                </MapMarker>
              ))}
              <MapControls position="bottom-right" showZoom showLocate />
            </MapcnMap>
            <div className="absolute bottom-2 left-2 flex items-center gap-3 px-3 py-1.5 rounded bg-gray-900/90 border border-gray-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-white/70 text-[10px] font-semibold uppercase">You</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-white/70 text-[10px] font-semibold uppercase">Reported Location</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-white/70 text-[10px] font-semibold uppercase">Tracking</span>
              </span>
            </div>
          </div>

          <div className="border-t border-gray-800 bg-gray-900/80 flex flex-col max-h-[220px]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-500" />
                <span className="text-white text-sm font-bold tracking-wide">Field notes & logs</span>
              </div>
              <button type="button" className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white/80 text-xs font-medium">
                Export log
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {logs.length === 0 ? (
                <p className="text-white/40 text-xs">No log entries yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-xs">
                    <span className="text-white/40 font-mono shrink-0">{formatLogTime(log.createdAt)}</span>
                    <div className="min-w-0">
                      {log.actor?.name && (
                        <span className="text-red-400/80 font-medium">{log.actor.name}</span>
                      )}
                      <p className="text-white/80 leading-relaxed">{log.note ?? log.action.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-gray-900/80 border-t lg:border-t-0 lg:border-l border-gray-800">
          <div className="bg-red-600 px-4 py-2 text-center">
            <span className="text-white text-sm font-black tracking-wider uppercase">High alert</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
              <h3 className="text-white/50 text-[10px] font-bold tracking-widest uppercase mb-2">Incident details</h3>
              <p className="text-white font-medium text-sm">{incident?.title ?? mission.missionType}</p>
              <p className="text-white/60 text-xs mt-0.5">{incident?.addressText ?? "—"}</p>
              <div className="flex gap-2 mt-3">
                <div className="px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-white/50 text-[9px] uppercase font-semibold">Priority</p>
                  <p className="text-red-400 font-bold text-sm">{mission.priority}</p>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-white/50 text-[9px] uppercase font-semibold">Distance</p>
                  <p className="text-red-400 font-mono font-bold text-sm">{distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}</p>
                </div>
              </div>
            </div>

            {(mission.linkedIncidents?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-white/50 text-[10px] font-bold tracking-widest uppercase mb-2">Linked incidents</h3>
                <ul className="space-y-1.5">
                  {mission.linkedIncidents!.map((li) => (
                    <li key={li.incidentId} className="px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50 text-xs">
                      <p className="text-white font-medium truncate">{li.incident.title}</p>
                      <p className="text-white/50 text-[10px] uppercase">{li.incident.status}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mission.report && (
              <div>
                <h3 className="text-white/50 text-[10px] font-bold tracking-widest uppercase mb-2">Completion report</h3>
                <div className="px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50 space-y-2 text-xs">
                  <p className="text-white/90">{mission.report.summary}</p>
                  {mission.report.actionsTaken && <p className="text-white/60"><span className="text-white/50">Actions:</span> {mission.report.actionsTaken}</p>}
                  {mission.report.resourcesUsed && <p className="text-white/60"><span className="text-white/50">Resources:</span> {mission.report.resourcesUsed}</p>}
                  {mission.report.casualties != null && mission.report.casualties > 0 && <p className="text-red-400/90">Casualties: {mission.report.casualties}</p>}
                  {mission.report.propertyDamage && <p className="text-white/60"><span className="text-white/50">Property damage:</span> {mission.report.propertyDamage}</p>}
                  <p className="text-white/40 text-[10px]">Submitted {new Date(mission.report.submittedAt).toLocaleString()}</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-white/50 text-[10px] font-bold tracking-widest uppercase mb-2">Active units</h3>
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50">
                    {a.role === "LEADER" ? <Crosshair className="w-4 h-4 text-red-500 shrink-0" /> : <Activity className="w-4 h-4 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{a.assignee.name}</p>
                      <p className="text-red-400 text-[10px] font-bold">{a.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-800 space-y-2">
            {isMember ? (
              <>
                <p className="text-white/40 text-xs text-center">View only — mission actions require Coordinator or Director role.</p>
                <button
                  type="button"
                  onClick={() => navigate("/volunteer-dashboard/mission-history")}
                  className="w-full py-3.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
                >
                  View history
                </button>
              </>
            ) : (
              <>
                {/* Coordinator/Director: confirm or reject completion report */}
                {isLeadership && mission.status === "COMPLETED" && mission.report && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConfirmCompletion(true)}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm completion
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectCompletion(true)}
                      disabled={actionLoading}
                      className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-red-400 text-xs font-semibold transition-colors"
                    >
                      Reject completion
                    </button>
                  </>
                )}

                {/* Coordinator/Director: agency decision after volunteer rejection */}
                {isLeadership && mission.status === "ASSIGNED" && logs.some((l) => l.action === "REJECTED") && (
                  <>
                    <p className="text-amber-400 text-xs font-semibold text-center">Volunteer rejected — take action</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAgencyDecision("FAIL", "Mission failed after volunteer rejection.")}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        {actionLoading && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
                        Fail mission
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/volunteer-dashboard/validation")}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold"
                      >
                        Reassign
                      </button>
                    </div>
                  </>
                )}

                {/* Volunteer: advance mission phase */}
                {canAdvancePhase && (
                  <>
                    <button
                      type="button"
                      onClick={handlePhaseAction}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {mission.status === "IN_PROGRESS" ? "Finish mission" : mission.status === "ACCEPTED" ? "Start travel" : mission.status === "EN_ROUTE" ? "Arrive on site" : "Start work"}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFailure(true)}
                        disabled={actionLoading}
                        className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-red-400 text-xs font-semibold transition-colors"
                      >
                        Report failure
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancel(true)}
                        disabled={actionLoading}
                        className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white/60 text-xs font-semibold transition-colors"
                      >
                        Cancel mission
                      </button>
                    </div>
                  </>
                )}

                {/* Fallback: no actions available */}
                {!canAdvancePhase && !(isLeadership && mission.status === "COMPLETED" && mission.report) && !(isLeadership && mission.status === "ASSIGNED" && logs.some((l) => l.action === "REJECTED")) && (
                  <button
                    type="button"
                    onClick={() => navigate("/volunteer-dashboard/mission-history")}
                    className="w-full py-3.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
                  >
                    View history
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

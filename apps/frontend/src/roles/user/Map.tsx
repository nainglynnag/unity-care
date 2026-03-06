import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/user/mapcn';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import PhoneIcon from '@mui/icons-material/Phone';
import StarIcon from '@mui/icons-material/Star';
import { Check, ChevronRight } from 'lucide-react';
import { getIncident, type IncidentDetail } from '../../lib/incidents';

const defaultZoom = 15;

function MapFitBounds({
  userLocation,
  incidentPosition,
  volunteerPosition,
}: {
  userLocation: [number, number] | null;
  incidentPosition: [number, number] | null;
  volunteerPosition: [number, number] | null;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;
    const points: [number, number][] = [];
    if (userLocation) points.push([userLocation[1], userLocation[0]]);
    if (incidentPosition) points.push([incidentPosition[1], incidentPosition[0]]);
    if (volunteerPosition) points.push([volunteerPosition[1], volunteerPosition[0]]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({
        center: points[0],
        zoom: defaultZoom,
        duration: 800,
      });
      return;
    }
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    map.fitBounds([sw, ne], { padding: 80, maxZoom: 15, duration: 800 });
  }, [map, userLocation, incidentPosition, volunteerPosition]);
  return null;
}

function MapPage() {
  const navigate = useNavigate();
  const locationState = useLocation().state as {
    lat?: number;
    lng?: number;
    incidentId?: string;
    primaryContact?: { name: string; phone: string };
  } | null;
  const incidentId = locationState?.incidentId;
  const primaryContact = locationState?.primaryContact;
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    locationState?.lat != null && locationState?.lng != null
      ? [locationState.lat, locationState.lng]
      : null
  );
  const [locationLoading, setLocationLoading] = useState(
    !(locationState?.lat != null && locationState?.lng != null)
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [volunteerPosition, setVolunteerPosition] = useState<[number, number] | null>(null);
  const [volunteerImageFailed, setVolunteerImageFailed] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const leader =
    incident?.missions?.[0]?.assignments?.find((a) => a.role === 'LEADER')?.assignee ??
    incident?.missions?.[0]?.assignments?.[0]?.assignee ??
    null;
  const showVolunteerImage = leader?.profileImageUrl && !volunteerImageFailed;
  const volunteerInitials = leader?.name
    ? leader.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
    : '';

  useEffect(() => {
    setVolunteerImageFailed(false);
  }, [leader?.id, leader?.profileImageUrl]);

  const hasMission = (incident?.missions?.length ?? 0) > 0;
  const missionStatus = incident?.missions?.[0]?.status ?? null;
  const PROCESS_STAGES = [
    { key: 'en_route', label: 'En route' },
    { key: 'at_scene', label: 'At scene' },
    { key: 'executing', label: 'Executing' },
    { key: 'finish', label: 'Finalizing' },
  ] as const;
  const getMissionStageIndex = (status: string | null): number => {
    if (!status) return -1;
    switch (status) {
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 0;
      case 'EN_ROUTE':
        return 0;
      case 'ON_SITE':
        return 1;
      case 'IN_PROGRESS':
        return 2;
      case 'COMPLETED':
      case 'CLOSED':
        return 3;
      default:
        return -1;
    }
  };
  const missionStageIndex = getMissionStageIndex(missionStatus);
  const hasReachedEnRoute =
    missionStatus === 'EN_ROUTE' ||
    missionStatus === 'ON_SITE' ||
    missionStatus === 'IN_PROGRESS' ||
    missionStatus === 'COMPLETED' ||
    missionStatus === 'CLOSED';

  // Real-time user location: use watchPosition so the blue dot updates as the user moves.
  useEffect(() => {
    if (locationState?.lat != null && locationState?.lng != null) {
      setUserLocation([locationState.lat, locationState.lng]);
      setLocationLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocationLoading(false);
      return;
    }
    let watchId: number | null = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
        setLocationLoading(false);
      },
      () => {
        setLocationError('Unable to get your location.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [locationState?.lat, locationState?.lng]);

  // Fetch incident and volunteer position from backend when incidentId is set; poll to refresh volunteer location.
  useEffect(() => {
    if (!incidentId) {
      setIncident(null);
      setVolunteerPosition(null);
      return;
    }
    const load = () => {
      getIncident(incidentId).then((data) => {
        if (!data) return;
        setIncident(data);
        const mission = data.missions?.[0];
        const latest = mission?.tracking?.[0];
        if (latest?.latitude != null && latest?.longitude != null) {
          setVolunteerPosition([latest.latitude, latest.longitude]);
        } else {
          setVolunteerPosition(null);
        }
      });
    };
    load();
    pollIntervalRef.current = setInterval(load, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [incidentId]);

  // When mission is completed/closed while user is on Map, redirect to Complete Mission (same as Chat).
  useEffect(() => {
    if (!incident?.missions?.[0] || !incidentId) return;
    const status = incident.missions[0].status;
    if (status !== 'COMPLETED' && status !== 'CLOSED') return;
    const leaderAssignment = incident.missions[0].assignments?.find((a) => a.role === 'LEADER')?.assignee ?? incident.missions[0].assignments?.[0]?.assignee;
    const leaderName = leaderAssignment?.name ?? 'Volunteer';
    const leaderProfileImageUrl = leaderAssignment?.profileImageUrl ?? undefined;
    navigate('/completemission', {
      replace: true,
      state: {
        volunteerName: leaderName,
        volunteerRole: 'Mission leader',
        volunteerProfileImageUrl: leaderProfileImageUrl,
        incidentId,
      },
    });
  }, [incident, incidentId, navigate]);

  const incidentPosition: [number, number] | null =
    incident?.latitude != null && incident?.longitude != null
      ? [incident.latitude, incident.longitude]
      : null;

  const initialCenter: [number, number] = userLocation
    ? [userLocation[1], userLocation[0]]
    : incidentPosition
      ? [incidentPosition[1], incidentPosition[0]]
      : [0, 20];
  const initialZoom = userLocation || incidentPosition ? defaultZoom : 2;

  const handleCallContact = () => {
    navigate("/voicecall", {
      state: incidentId ? { incidentId, primaryContact } : undefined,
    });
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-gray-950">
      <div className="flex-1 relative min-w-0 min-h-[50vh] lg:min-h-0">
        <div className="relative h-full w-full">
          {locationLoading && (
            <>
              <style>{`
                @keyframes map-finding-pulse {
                  0% { transform: scale(0.5); opacity: 0.6; }
                  100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes map-finding-dot {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.3); opacity: 0.8; }
                }
                .map-finding-ring {
                  animation: map-finding-pulse 1.8s ease-out infinite;
                }
                .map-finding-ring-2 { animation-delay: 0.6s; }
                .map-finding-ring-3 { animation-delay: 1.2s; }
                .map-finding-dot, .map-finding-dot-legend {
                  animation: map-finding-dot 1.2s ease-in-out infinite;
                }
              `}</style>
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]"
                aria-hidden
              >
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute w-16 h-16 rounded-full border-2 border-blue-400 map-finding-ring" />
                  <div className="absolute w-16 h-16 rounded-full border-2 border-blue-400 map-finding-ring map-finding-ring-2" />
                  <div className="absolute w-16 h-16 rounded-full border-2 border-blue-400 map-finding-ring map-finding-ring-3" />
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg map-finding-dot" />
                </div>
              </div>
            </>
          )}
        <MapcnMap
          theme="dark"
          className="h-full w-full"
          viewport={{
            center: initialCenter,
            zoom: initialZoom,
          }}
        >
          {/* Volunteer position — same pin style as Validation "Reported location" */}
          {volunteerPosition && (
            <MapMarker
              longitude={volunteerPosition[1]}
              latitude={volunteerPosition[0]}
            >
              <MarkerContent>
                <div className="flex flex-col items-center">
                  <div className="px-2 py-1 rounded bg-red-500 text-white text-xs font-semibold shadow-lg">
                    Volunteer
                  </div>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
                </div>
              </MarkerContent>
            </MapMarker>
          )}
          {/* My location — same style as Validation "you" (blue dot + ping) */}
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
          <MapFitBounds
            userLocation={userLocation}
            incidentPosition={null}
            volunteerPosition={volunteerPosition}
          />
          <MapControls
            position="bottom-right"
            showZoom
            showLocate
            onLocate={(coords) =>
              setUserLocation([coords.latitude, coords.longitude])
            }
          />
        </MapcnMap>
        </div>

        <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl shadow-lg">
            {locationLoading ? (
              <>
                <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white flex-shrink-0 map-finding-dot-legend" />
                <span>Finding your location…</span>
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white flex-shrink-0" />
                <span>{locationError ? 'Location denied' : 'My location'}</span>
              </>
            )}
          </div>
          {(volunteerPosition || incidentId) && (
            <div className="flex items-center gap-2 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl shadow-lg">
              <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white flex-shrink-0" />
              <span>{volunteerPosition ? 'Volunteer (live)' : hasMission ? 'Volunteer assigned; location when they share' : 'Waiting for volunteer'}</span>
            </div>
          )}
        </div>
      </div>

      <aside className="w-full lg:w-[min(380px,30%)] flex-shrink-0 bg-gray-950 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800 max-h-[50vh] lg:max-h-none overflow-hidden">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <h2 className="text-white font-medium text-lg">Volunteer Unit</h2>
          <button
            onClick={() =>
              navigate("/chat", {
                state: incidentId ? { incidentId, primaryContact } : undefined,
              })
            }
            className="p-1.5 text-white/70 hover:text-white hover:bg-gray-800 rounded-full transition-colors duration-200"
            aria-label="Back"
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Volunteer Profile — from backend when incident has mission */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-3 border-2 border-red-500/30 overflow-hidden text-white font-semibold text-lg">
              {showVolunteerImage ? (
                <img
                  src={leader!.profileImageUrl!}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setVolunteerImageFailed(true)}
                />
              ) : volunteerInitials ? (
                <span>{volunteerInitials}</span>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">
              {leader?.name ?? 'Volunteer'}
            </h3>
            <p className="text-gray-400 text-sm mb-2">Mission leader</p>
            <div className="flex items-center gap-1.5">
              <StarIcon className="text-amber-400" sx={{ fontSize: 16 }} />
              <span className="text-gray-300 text-sm font-medium">—</span>
            </div>
          </div>

          {/* Process: vertical stepper — theme colors, extends toward Voice Call */}
          {hasMission && (
            <div className="bg-gray-900 rounded-xl px-9 py-6 border border-red-500/20 flex-1 min-h-0 flex flex-col">
              <h3 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wide">Process</h3>
              <div className="flex flex-col flex-1 min-h-0">
                {PROCESS_STAGES.map((stage, idx) => {
                  const done = idx < missionStageIndex;
                  const active = idx === missionStageIndex && (idx > 0 || hasReachedEnRoute);
                  const doneOrReached = done || active;
                  const isLast = idx === PROCESS_STAGES.length - 1;
                  return (
                    <div key={stage.key} className="flex items-start gap-4 flex-1 min-h-0">
                      <div className="flex flex-col items-center shrink-0 h-full">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 ${
                            done ? 'bg-red-500 border-red-500 text-white' : active ? 'border-red-500/60 bg-red-500/10 text-red-400' : 'border-gray-600 bg-gray-950/50 text-gray-500'
                          }`}
                        >
                          {done ? <Check className="w-4 h-4" /> : active ? <ChevronRight className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 flex-1 min-h-10 my-1 ${doneOrReached ? 'bg-red-500/80' : 'bg-gray-700'}`} />
                        )}
                      </div>
                      <span className={`text-sm font-medium pt-2 ${done ? 'text-red-400' : active ? 'text-red-400' : 'text-gray-500'}`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200"
            onClick={() => handleCallContact()}
          >
            <PhoneIcon sx={{ fontSize: 20 }} />
            Voice Call
          </button>
        </div>
      </aside>
    </div>
  );
}

export default MapPage;

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
import { getIncident, type IncidentDetail } from '../../lib/incidents';

const defaultZoom = 15;

function MapFitBounds({
  userLocation,
  volunteerPosition,
}: {
  userLocation: [number, number] | null;
  volunteerPosition: [number, number] | null;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !userLocation) return;
    const points: [number, number][] = [[userLocation[1], userLocation[0]]];
    if (volunteerPosition) {
      points.push([volunteerPosition[1], volunteerPosition[0]]);
    }
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
  }, [map, userLocation, volunteerPosition]);
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (locationState?.lat != null && locationState?.lng != null) {
      setLocationLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
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
        setLocationError('Unable to get your location.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
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
    pollIntervalRef.current = setInterval(load, 10000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [incidentId]);

  const initialCenter: [number, number] = userLocation
    ? [userLocation[1], userLocation[0]]
    : [0, 20];
  const initialZoom = userLocation ? defaultZoom : 2;

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
              <span>{volunteerPosition ? 'Volunteer (live)' : 'Volunteer — en route'}</span>
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
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-3 border-2 border-red-500/30">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">
              {incident?.missions?.[0]?.assignments?.find((a) => a.role === 'LEADER')?.assignee?.name ??
                incident?.missions?.[0]?.assignments?.[0]?.assignee?.name ??
                'Volunteer'}
            </h3>
            <p className="text-gray-400 text-sm mb-2">Mission leader</p>
            <div className="flex items-center gap-1.5">
              <StarIcon className="text-amber-400" sx={{ fontSize: 16 }} />
              <span className="text-gray-300 text-sm font-medium">—</span>
            </div>
          </div>

          {/* ETA / Status — from backend mission status */}
          <div className="bg-gray-800 rounded-xl px-5 py-4 border border-red-500/20">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Status</span>
              <span className="text-white text-lg font-bold">
                {incident?.missions?.[0]?.status?.replace(/_/g, ' ') ?? '—'}
              </span>
            </div>
            <p className="text-gray-300 text-sm font-medium mb-1">
              {volunteerPosition ? 'Volunteer location (live from app)' : 'Waiting for volunteer location…'}
            </p>
            <p className="text-gray-500 text-xs">
              {incidentId ? 'Location updates after found volunteer' : 'Open map from chat to see live position'}
            </p>
          </div>

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

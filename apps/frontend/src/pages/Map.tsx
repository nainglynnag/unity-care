import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  useMap,
} from '@/components/mapcn';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import PhoneIcon from '@mui/icons-material/Phone';
import StarIcon from '@mui/icons-material/Star';

const defaultZoom = 15;

// Car placed nearby user (~0.8–1 km away) so route follows roads to you [lat, lng]
const CAR_OFFSET_LAT = 0.008;
const CAR_OFFSET_LNG = -0.012;

function getCarPositionNearUser(userLat: number, userLng: number): [number, number] {
  return [userLat + CAR_OFFSET_LAT, userLng + CAR_OFFSET_LNG];
}

function getRouteToUser(
  ambulanceLat: number,
  ambulanceLng: number,
  userLat: number,
  userLng: number
): [number, number][] {
  return [
    [ambulanceLng, ambulanceLat],
    [
      ambulanceLng + (userLng - ambulanceLng) * 0.33,
      ambulanceLat + (userLat - ambulanceLat) * 0.33,
    ],
    [
      ambulanceLng + (userLng - ambulanceLng) * 0.66,
      ambulanceLat + (userLat - ambulanceLat) * 0.66,
    ],
    [userLng, userLat],
  ];
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

async function fetchRoadRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<[number, number][] | null> {
  const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates?.length) {
      return null;
    }
    return data.routes[0].geometry.coordinates as [number, number][];
  } catch {
    return null;
  }
}

function MapFitBounds({
  userLocation,
  ambulancePosition,
}: {
  userLocation: [number, number] | null;
  ambulancePosition: [number, number] | null;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !userLocation) return;
    const points: [number, number][] = [[userLocation[1], userLocation[0]]];
    if (ambulancePosition) {
      points.push([ambulancePosition[1], ambulancePosition[0]]);
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
  }, [map, userLocation, ambulancePosition]);
  return null;
}

function MapPage() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [roadRouteCoords, setRoadRouteCoords] = useState<[number, number][]>(
    []
  );

  useEffect(() => {
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
  }, []);

  const ambulancePositionOffset = userLocation
    ? getCarPositionNearUser(userLocation[0], userLocation[1])
    : null;

  // Car at start of road route so it's on the road, not in the river
  const ambulancePositionOnRoad =
    roadRouteCoords.length >= 2
      ? ([roadRouteCoords[0][1], roadRouteCoords[0][0]] as [number, number])
      : null;
  const ambulancePosition = ambulancePositionOnRoad ?? ambulancePositionOffset;

  useEffect(() => {
    if (!userLocation) {
      setRoadRouteCoords([]);
      return;
    }
    const [userLat, userLng] = userLocation;
    const [ambLat, ambLng] = getCarPositionNearUser(userLat, userLng);
    let cancelled = false;
    fetchRoadRoute(ambLng, ambLat, userLng, userLat).then((coords) => {
      if (!cancelled && coords && coords.length >= 2) {
        setRoadRouteCoords(coords);
      } else if (!cancelled) {
        setRoadRouteCoords(getRouteToUser(ambLat, ambLng, userLat, userLng));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  const fallbackRouteCoords =
    userLocation && ambulancePositionOffset
      ? getRouteToUser(
          ambulancePositionOffset[0],
          ambulancePositionOffset[1],
          userLocation[0],
          userLocation[1]
        )
      : [];
  const routeCoords =
    roadRouteCoords.length >= 2 ? roadRouteCoords : fallbackRouteCoords;

  const initialCenter: [number, number] = userLocation
    ? [userLocation[1], userLocation[0]]
    : [0, 20];
  const initialZoom = userLocation ? defaultZoom : 2;

  const handleCallContact = () => {
    navigate("/voicecall");
  };

  return (
    <div className="h-screen flex bg-gray-950">
      <div className="flex-1 relative min-w-0">
        <MapcnMap
          theme="dark"
          className="h-full w-full"
          viewport={{
            center: initialCenter,
            zoom: initialZoom,
          }}
        >
          {routeCoords.length >= 2 && (
            <MapRoute
              coordinates={routeCoords}
              color="#ef4444"
              width={4}
              opacity={0.95}
            />
          )}
          {ambulancePositionOnRoad && (
            <MapMarker
              longitude={ambulancePositionOnRoad[1]}
              latitude={ambulancePositionOnRoad[0]}
            >
              <MarkerContent>
                <span
                  className="text-2xl"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  }}
                >
                  🚗
                </span>
              </MarkerContent>
            </MapMarker>
          )}
          {userLocation && (
            <MapMarker
              longitude={userLocation[1]}
              latitude={userLocation[0]}
            >
              <MarkerContent>
                <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
              </MarkerContent>
            </MapMarker>
          )}
          <MapFitBounds
            userLocation={userLocation}
            ambulancePosition={ambulancePosition}
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

        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl shadow-lg">
          <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
          <span>
            {locationLoading
              ? 'Getting location…'
              : locationError
                ? 'Location denied'
                : 'My Location'}
          </span>
        </div>
      </div>

      <aside className="w-[min(380px,30%)] flex-shrink-0 bg-gray-950 flex flex-col border-l border-gray-800">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <h2 className="text-white font-medium text-lg">Volunteer Unit</h2>
          <button
            onClick={() => navigate("/chat")}
            className="p-1.5 text-white/70 hover:text-white hover:bg-gray-800 rounded-full transition-colors duration-200"
            aria-label="Back"
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Volunteer Profile */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-3 border-2 border-red-500/30">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">Sarah Martinez</h3>
            <p className="text-gray-400 text-sm mb-2">Certified First Responder</p>
            <div className="flex items-center gap-1.5">
              <StarIcon className="text-amber-400" sx={{ fontSize: 16 }} />
              <span className="text-gray-300 text-sm font-medium">4.8</span>
              <span className="text-gray-500 text-xs">(50+ responses)</span>
            </div>
          </div>

          {/* ETA Card */}
          <div className="bg-gray-800 rounded-xl px-5 py-4 border border-red-500/20">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">ETA</span>
              <span className="text-white text-2xl font-bold">3 min</span>
            </div>
            <p className="text-gray-300 text-sm font-medium mb-1">Ambulance - En route</p>
            <p className="text-gray-500 text-xs">~0.8 miles away</p>
          </div>

          {/* Equipment */}
          <div>
            <p className="text-white font-medium text-base mb-3">Equipment</p>
            <div className="flex flex-wrap gap-2">
              {['First Aid Kit', 'AED', 'Oxygen'].map((item) => (
                <span
                  key={item}
                  className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-full border border-gray-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200"
            onClick={() => handleCallContact()}
          >
            <PhoneIcon sx={{ fontSize: 20 }} />
            Call Contact
          </button>
        </div>
      </aside>
    </div>
  );
}

export default MapPage;

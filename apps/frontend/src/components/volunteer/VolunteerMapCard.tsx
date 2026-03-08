import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MarkerContent,
} from "@/components/user/mapcn";
import type { NearbyIncident } from "@/lib/incidents";

const VOLUNTEER_MAP_ZOOM = 13;

type VolunteerMapCardProps = {
  userLocation: [number, number] | null;
  locationLoading: boolean;
  locationError: string | null;
  onSetLocation: (lat: number, lng: number) => void;
  incidents?: NearbyIncident[];
  onIncidentClick?: (id: string) => void;
};

export function VolunteerMapCard({
  userLocation,
  locationLoading,
  locationError,
  onSetLocation,
  incidents = [],
  onIncidentClick,
}: VolunteerMapCardProps) {
  const mapCenter: [number, number] | null = userLocation
    ? [userLocation[1], userLocation[0]]
    : null;

  const incidentCount = incidents.filter(
    (i) => i.latitude != null && i.longitude != null,
  ).length;

  return (
    <div className="lg:col-span-2 bg-gray-800/80 border border-gray-800 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-500 text-xs font-semibold">
          LIVE MAP
        </span>
        <div className="flex flex-wrap items-center gap-3 text-white/60 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            {locationLoading
              ? "Getting location…"
              : locationError
                ? "Location denied"
                : "Your position"}
          </span>
          {incidentCount > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              {incidentCount} incident{incidentCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-64 min-h-[16rem]">
        {mapCenter ? (
          <MapcnMap
            theme="dark"
            className="h-full w-full rounded-b-xl"
            viewport={{
              center: mapCenter,
              zoom: VOLUNTEER_MAP_ZOOM,
            }}
          >
            {/* Volunteer's own position */}
            <MapMarker
              longitude={userLocation![1]}
              latitude={userLocation![0]}
            >
              <MarkerContent>
                <div className="relative">
                  <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                  <div className="absolute -inset-2 rounded-full bg-blue-500/20 animate-ping" />
                </div>
              </MarkerContent>
            </MapMarker>

            {/* Nearby incident locations (civilian reporters) */}
            {incidents.map((inc) => {
              if (inc.latitude == null || inc.longitude == null) return null;
              return (
                <MapMarker
                  key={inc.id}
                  longitude={inc.longitude}
                  latitude={inc.latitude}
                  onClick={() => onIncidentClick?.(inc.id)}
                >
                  <MarkerContent>
                    <div className="flex flex-col items-center cursor-pointer group">
                      <div className="px-2 py-1 rounded bg-red-500/90 text-white text-[10px] font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                        {inc.title}
                      </div>
                      <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-lg group-hover:scale-125 transition-transform" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              );
            })}

            <MapControls
              position="bottom-right"
              showZoom
              showLocate
              onLocate={(coords) =>
                onSetLocation(coords.latitude, coords.longitude)
              }
            />
          </MapcnMap>
        ) : (
          <div className="h-full w-full flex items-center justify-center rounded-b-xl bg-gray-900/50 text-white/60 text-sm">
            {locationLoading
              ? "Getting your position…"
              : locationError
                ? "Allow location to show map at your position"
                : "Enable location to show map"}
          </div>
        )}
      </div>
    </div>
  );
}


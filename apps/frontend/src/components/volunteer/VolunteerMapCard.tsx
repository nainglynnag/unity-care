import {
  Map as MapcnMap,
  MapControls,
  MapMarker,
  MarkerContent,
} from "@/components/user/mapcn";

const VOLUNTEER_MAP_ZOOM = 15;

type VolunteerMapCardProps = {
  userLocation: [number, number] | null;
  locationLoading: boolean;
  locationError: string | null;
  onSetLocation: (lat: number, lng: number) => void;
};

export function VolunteerMapCard({
  userLocation,
  locationLoading,
  locationError,
  onSetLocation,
}: VolunteerMapCardProps) {
  const mapCenter: [number, number] | null = userLocation
    ? [userLocation[1], userLocation[0]]
    : null;

  return (
    <div className="lg:col-span-2 bg-gray-800/80 border border-gray-800 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-500 text-xs font-semibold">
          SECTOR 04 - WEST END
        </span>
        <div className="flex flex-wrap items-center gap-3 text-white/60 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            {locationLoading
              ? "Getting location…"
              : locationError
                ? "Location denied"
                : "Your position"}
          </span>
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
            <MapMarker
              longitude={userLocation![1]}
              latitude={userLocation![0]}
            >
              <MarkerContent>
                <div className="h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-lg" />
              </MarkerContent>
            </MapMarker>
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


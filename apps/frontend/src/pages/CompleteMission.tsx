import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CheckIcon from "@mui/icons-material/Check";

type LocationState = {
  address: string | null;
  cityRegion: string | null;
  loading: boolean;
  error: string | null;
};

function CompleteMission() {
  const navigate = useNavigate();
  const locationState = useLocation().state as {
    address?: string;
    cityRegion?: string;
    responseTime?: string;
    volunteerName?: string;
  } | null;

  const [realLocation, setRealLocation] = useState<LocationState>({
    address: null,
    cityRegion: null,
    loading: true,
    error: null,
  });

  // Prefer passed state, then real location, then placeholders
  const locationText =
    locationState?.address ??
    realLocation.address ??
    (realLocation.loading ? "..." : realLocation.error ?? "Location unavailable");
  const cityRegion =
    locationState?.cityRegion ?? realLocation.cityRegion ?? (realLocation.loading ? "" : null);
  const responseTime = locationState?.responseTime ?? "3 minutes";
  const volunteerName = locationState?.volunteerName ?? "Sarah Martinez";

  // Get real user location (used when no location passed via navigation state)
  useEffect(() => {
    if (locationState?.address != null) {
      setRealLocation((prev) => ({ ...prev, loading: false }));
      return;
    }
    if (!navigator.geolocation) {
      setRealLocation((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation not supported",
      }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address;
          const road = addr?.road || addr?.street || "";
          const house = addr?.house_number || "";
          const address = [house, road].filter(Boolean).join(" ") || data.display_name?.split(",")[0] || null;
          const city = addr?.city || addr?.town || addr?.village || addr?.municipality || "";
          const state = addr?.state || addr?.county || "";
          const cityRegion = [city, state].filter(Boolean).join(", ") || null;
          setRealLocation((prev) => ({
            ...prev,
            loading: false,
            address: address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            cityRegion,
          }));
        } catch {
          setRealLocation((prev) => ({
            ...prev,
            loading: false,
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            cityRegion: "Coordinates",
          }));
        }
      },
      (err) => {
        setRealLocation((prev) => ({
          ...prev,
          loading: false,
          error: err.message || "Unable to get location",
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [locationState?.address]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-500"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-white text-xl font-bold">Unity Care</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-6">
          <CheckIcon className="text-white" sx={{ fontSize: 48 }} />
        </div>
        <h1 className="text-white text-2xl font-bold mb-2">Mission Completed</h1>
        <p className="text-gray-400 text-sm mb-10 text-center max-w-sm">
          The emergency has been successfully resolved.
        </p>

        {/* Info panels */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="border border-red-500/60 rounded-xl p-4 flex flex-col items-center text-center">
            <LocationOnIcon className="text-red-500 mb-2" fontSize="medium" />
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
              Location
            </span>
            <span
              className={`text-sm font-medium ${realLocation.error ? "text-amber-400" : "text-white"}`}
            >
              {locationText}
            </span>
            {cityRegion && (
              <span className="text-gray-500 text-xs mt-0.5">{cityRegion}</span>
            )}
          </div>
          <div className="border border-red-500/60 rounded-xl p-4 flex flex-col items-center text-center">
            <AccessTimeIcon className="text-red-500 mb-2" fontSize="medium" />
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
              Response Time
            </span>
            <span className="text-white text-sm font-medium">{responseTime}</span>
          </div>
          <div className="border border-red-500/60 rounded-xl p-4 flex flex-col items-center text-center">
            <PersonOutlineIcon className="text-red-500 mb-2" fontSize="medium" />
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
              Volunteer
            </span>
            <span className="text-white text-sm font-medium">{volunteerName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full max-w-xs py-3 px-6 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
        >
          Return Home
        </button>
      </main>
    </div>
  );
}

export default CompleteMission;

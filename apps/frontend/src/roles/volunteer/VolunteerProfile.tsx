import { useState, useEffect } from "react";
import {
  Bell,
  Calendar,
  BarChart3,
  Award,
  Wrench,
  Loader2,
} from "lucide-react";
import { getCurrentUser } from "../../lib/api";
import {
  getVolunteerProfile,
  updateAvailability,
  type VolunteerProfile as VolunteerProfileType,
} from "../../lib/volunteerProfile";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const SLOTS = ["AM", "PM"] as const;

// Placeholder when backend has no weekly slots (backend only has isAvailable boolean)
const MOCK_AVAILABILITY: Record<string, { AM: boolean; PM: boolean }> = {
  MON: { AM: true, PM: false },
  TUE: { AM: false, PM: true },
  WED: { AM: false, PM: true },
  THU: { AM: true, PM: true },
  FRI: { AM: true, PM: true },
  SAT: { AM: false, PM: false },
  SUN: { AM: false, PM: false },
};

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function VolunteerProfile() {
  const [profile, setProfile] = useState<VolunteerProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [lastLocationLabel, setLastLocationLabel] = useState<string | null>(null);
  const [lastLocationLoading, setLastLocationLoading] = useState(false);

  const user = getCurrentUser();
  const displayName = user?.name ?? "Volunteer";
  const initials = getInitials(displayName);

  useEffect(() => {
    let cancelled = false;
    setError("");
    getVolunteerProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve last known coordinates to a human-readable location when available
  useEffect(() => {
    if (
      profile?.lastKnownLatitude == null ||
      profile?.lastKnownLongitude == null
    ) {
      setLastLocationLabel(null);
      setLastLocationLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setLastLocationLoading(true);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${profile.lastKnownLatitude}&lon=${profile.lastKnownLongitude}`;

    fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const label: string | undefined =
          (data.display_name as string | undefined) ??
          (data.address && data.address.city && data.address.country
            ? `${data.address.city}, ${data.address.country}`
            : undefined);
        setLastLocationLabel(label ?? null);
      })
      .catch(() => {
        if (!cancelled) setLastLocationLabel(null);
      })
      .finally(() => {
        if (!cancelled) setLastLocationLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile?.lastKnownLatitude, profile?.lastKnownLongitude]);

  const handleSetAvailability = async (isAvailable: boolean) => {
    if (!profile) return;
    setAvailabilityUpdating(true);
    setError("");
    try {
      const body: { isAvailable: boolean; latitude?: number; longitude?: number } = {
        isAvailable,
      };
      if (isAvailable && navigator.geolocation) {
        const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          );
        });
        if (coords != null) {
          body.latitude = coords.latitude;
          body.longitude = coords.longitude;
        }
      }
      const updated = await updateAvailability(body);
      setProfile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" aria-hidden />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="p-6">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-red-400">
          <p className="font-medium">{error}</p>
          <p className="text-sm mt-1 text-white/70">You may need to sign in as a volunteer.</p>
        </div>
      </div>
    );
  }

  const skills = profile?.skills?.map((s) => s.skill?.name).filter(Boolean) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Page header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-white text-xl font-semibold">Volunteer Profile</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 text-white/70 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
            <div className="text-right hidden sm:block">
              <p className="text-white font-medium text-sm">{displayName}</p>
              <p className="text-red-500 text-xs font-medium">VOLUNTEER</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0 border-2 border-red-500/30">
              <span className="text-white text-sm font-semibold">{initials}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-4 py-2 text-amber-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Summary + Weekly Availability */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile summary */}
          <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      profile?.isAvailable ? "bg-emerald-500" : "bg-gray-500"
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      profile?.isAvailable ? "text-emerald-400" : "text-white/50"
                    }`}
                  >
                    {profile?.isAvailable ? "STATUS: ACTIVE / ON-CALL" : "STATUS: OFFLINE"}
                  </span>
                </div>
                <h2 className="text-white text-2xl font-bold mb-1">{displayName}</h2>
                <p className="text-white/70 text-sm">
                  {profile?.availabilityRadiusKm != null
                    ? `Availability radius: ${profile.availabilityRadiusKm} km`
                    : "Volunteer"}
                </p>
                {profile?.lastKnownLatitude != null &&
                  profile?.lastKnownLongitude != null && (
                    <p className="text-white/50 text-xs mt-1">
                      Last location:{" "}
                      {lastLocationLoading
                        ? "Resolving location…"
                        : lastLocationLabel ??
                          `${profile.lastKnownLatitude.toFixed(
                            5,
                          )}, ${profile.lastKnownLongitude.toFixed(5)}`}
                    </p>
                  )}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {skills.map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 bg-gray-700 text-white/90 text-xs font-medium rounded-md"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3">
                  {availabilityUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSetAvailability(true)}
                        className={`text-xs focus:outline-none ${
                          profile?.isAvailable
                            ? "text-emerald-400 cursor-default"
                            : "text-white/50 hover:text-red-400"
                        }`}
                      >
                        Set available
                      </button>
                      <span className="text-white/30">·</span>
                      <button
                        type="button"
                        onClick={() => handleSetAvailability(false)}
                        className={`text-xs focus:outline-none ${
                          !profile?.isAvailable
                            ? "text-white/40 cursor-default"
                            : "text-white/50 hover:text-red-400"
                        }`}
                      >
                        Set offline
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Availability (UI placeholder; backend has isAvailable only) */}
          <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-red-500" />
              <h3 className="text-white font-semibold">Weekly Availability</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="text-white/70 text-xs font-semibold uppercase tracking-wider pb-2 pr-1 text-center"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot) => (
                    <tr key={slot}>
                      {DAYS.map((day) => {
                        const available = MOCK_AVAILABILITY[day]?.[slot] ?? false;
                        return (
                          <td key={`${day}-${slot}`} className="p-0.5">
                            <div
                              className={`h-8 rounded ${
                                available ? "bg-red-500/80" : "bg-gray-700/80"
                              }`}
                              title={`${day} ${slot}: ${available ? "Available" : "Offline"}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/80 shrink-0" />
                ONLINE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-700 shrink-0" />
                OFFLINE
              </span>
            </div>
            <p className="text-white/40 text-xs mt-2">Schedule is indicative; current status above.</p>
          </div>
        </div>

        {/* Right column: Photo + Mission Impact + Awards */}
        <div className="space-y-6">
          {/* Profile photo card */}
          <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 flex flex-col items-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <div className="w-16 h-16 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
              <span className="text-lg font-medium text-white/90">{initials}</span>
            </div>
            <p className="text-white font-medium mt-3 text-center">{displayName}</p>
          </div>

          {/* Mission Impact (placeholder; no backend stats yet) */}
          <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-red-500" />
              <h3 className="text-white font-semibold">Mission Impact</h3>
            </div>
            <div className="space-y-4 text-white/70 text-sm">
              <p>Mission stats will appear here when available.</p>
            </div>
          </div>

          {/* Awards & Equipment (placeholder) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-red-500" />
                <span className="text-white font-medium text-sm">Awards</span>
              </div>
              <p className="text-white/80 text-sm">—</p>
            </div>
            <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-5 h-5 text-red-500" />
                <span className="text-white font-medium text-sm">Equipment</span>
              </div>
              <p className="text-white/80 text-sm">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

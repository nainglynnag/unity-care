import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Calendar,
  BarChart3,
  Award,
  Wrench,
  Loader2,
  Pencil,
  X,
  Crown,
  Star,
  User,
} from "lucide-react";
import { getCurrentUser, setCurrentUser } from "../../lib/api";
import {
  getVolunteerProfile,
  updateAvailability,
  updateVolunteerProfile,
  type VolunteerProfile as VolunteerProfileType,
} from "../../lib/volunteerProfile";
import { updateProfile } from "../../lib/account";
import { getSkills, type Skill } from "../../lib/referenceData";
import { getMyAgencyMembership, type AgencyRole } from "../../lib/agencyTeam";

// Same role badge style as Team page
const ROLE_OPTIONS: { value: AgencyRole; label: string; icon: typeof Crown; bg: string }[] = [
  { value: "DIRECTOR", label: "Director", icon: Crown, bg: "bg-amber-500/20 text-amber-400" },
  { value: "COORDINATOR", label: "Coordinator", icon: Star, bg: "bg-blue-500/20 text-blue-400" },
  { value: "MEMBER", label: "Member", icon: User, bg: "bg-gray-600/30 text-gray-400" },
];

function getRoleBadge(role: AgencyRole | null) {
  if (!role) return { label: "Volunteer", icon: User, bg: "bg-gray-600/30 text-gray-400" };
  return ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[2];
}

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
  const [user, setUser] = useState(getCurrentUser());
  const [agencyRole, setAgencyRole] = useState<AgencyRole | null>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name ?? "Volunteer";

  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRadius, setEditRadius] = useState("");
  const [editSkillIds, setEditSkillIds] = useState<string[]>([]);
  const [editIsAvailable, setEditIsAvailable] = useState(false);
  const [editFormSkills, setEditFormSkills] = useState<Skill[]>([]);
  const [editFormSaving, setEditFormSaving] = useState(false);
  const [editFormLoadingSkills, setEditFormLoadingSkills] = useState(false);
  const initials = getInitials(displayName);
  const roleBadge = getRoleBadge(agencyRole);

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

  useEffect(() => {
    getMyAgencyMembership().then((m) => setAgencyRole(m?.myRole ?? null)).catch(() => {});
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

  const openEditForm = () => {
    setError("");
    setEditName(displayName);
    setEditRadius(String(profile?.availabilityRadiusKm ?? ""));
    setEditSkillIds(profile?.skills?.map((s) => s.skill?.id).filter(Boolean) as string[] ?? []);
    setEditIsAvailable(profile?.isAvailable ?? false);
    setShowEditForm(true);
    setEditFormLoadingSkills(true);
    getSkills()
      .then((list) => setEditFormSkills(list.filter((s) => s.isActive)))
      .catch(() => setEditFormSkills([]))
      .finally(() => setEditFormLoadingSkills(false));
  };

  const toggleEditFormSkill = (id: string) => {
    setEditSkillIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmitEditForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormSaving(true);
    setError("");
    try {
      const nameTrimmed = editName.trim();
      if (nameTrimmed && nameTrimmed !== displayName) {
        const updated = await updateProfile({ name: nameTrimmed });
        const prev = getCurrentUser();
        setCurrentUser({ ...prev, name: updated.name });
        setUser({ ...prev, name: updated.name });
      }
      const radiusNum = Number(editRadius);
      if (!isNaN(radiusNum) && radiusNum > 0) {
        const updated = await updateVolunteerProfile({
          availabilityRadiusKm: radiusNum,
          skillIds: editSkillIds,
        });
        setProfile(updated);
      } else {
        const updated = await updateVolunteerProfile({ skillIds: editSkillIds });
        setProfile(updated);
      }
      const updatedProfile = await updateAvailability({ isAvailable: editIsAvailable });
      setProfile(updatedProfile);
      setShowEditForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setEditFormSaving(false);
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
      {/* Edit profile modal */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !editFormSaving && setShowEditForm(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmitEditForm} className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-bold">Edit profile</h2>
                <button
                  type="button"
                  onClick={() => !editFormSaving && setShowEditForm(false)}
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {error && (
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-3 py-2 text-amber-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="edit-name" className="block text-white/80 text-sm font-medium mb-1.5">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-red-500"
                  placeholder="Your name"
                  disabled={editFormSaving}
                />
              </div>
              <div>
                <label htmlFor="edit-radius" className="block text-white/80 text-sm font-medium mb-1.5">Availability radius (km)</label>
                <input
                  id="edit-radius"
                  type="number"
                  min={1}
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-red-500"
                  placeholder="e.g. 25"
                  disabled={editFormSaving}
                />
              </div>
              <div>
                <span className="block text-white/80 text-sm font-medium mb-1.5">Availability status</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsAvailable}
                    onChange={(e) => setEditIsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                    disabled={editFormSaving}
                  />
                  <span className="text-white text-sm">Active / on-call</span>
                </label>
              </div>
              <div>
                <span className="block text-white/80 text-sm font-medium mb-1.5">Skills</span>
                {editFormLoadingSkills ? (
                  <p className="text-white/50 text-sm">Loading skills…</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                    {editFormSkills.map((skill) => (
                      <label
                        key={skill.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                          editSkillIds.includes(skill.id)
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-gray-800 text-white/70 border-gray-600 hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editSkillIds.includes(skill.id)}
                          onChange={() => toggleEditFormSkill(skill.id)}
                          className="sr-only"
                          disabled={editFormSaving}
                        />
                        {skill.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !editFormSaving && setShowEditForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-white/90 hover:bg-gray-700 text-sm font-medium transition-colors"
                  disabled={editFormSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={editFormSaving}
                >
                  {editFormSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-white text-xl font-semibold">Volunteer Profile</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openEditForm}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit profile
          </button>
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
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadge.bg}`}>
                <roleBadge.icon className="w-3 h-3" aria-hidden />
                {roleBadge.label}
              </span>
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
          <div ref={profileCardRef} className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
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
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadge.bg} mb-2 inline-block`}>
                  <roleBadge.icon className="w-3 h-3" aria-hidden />
                  {roleBadge.label}
                </span>
                <h2 className="text-white text-2xl font-bold mb-1">{displayName}</h2>
                <div className="text-white/70 text-sm">
                  <span>
                    {profile?.availabilityRadiusKm != null
                      ? `Availability radius: ${profile.availabilityRadiusKm} km`
                      : "Volunteer"}
                  </span>
                </div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.length > 0 ? (
                    skills.map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 bg-gray-700 text-white/90 text-xs font-medium rounded-md"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-white/30 text-xs">No skills</span>
                  )}
                </div>
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
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="w-[14.2857%] min-w-0 text-white/70 text-xs font-semibold uppercase tracking-wider pb-2 pr-1 text-center"
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
                          <td key={`${day}-${slot}`} className="w-[14.2857%] min-w-0 p-0.5">
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

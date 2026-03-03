import { API_BASE, authFetch } from "./api";

export type VolunteerProfileSkill = { skill: { id: string; name: string } };

export type VolunteerProfile = {
  userId: string;
  isAvailable: boolean;
  availabilityRadiusKm: number | null;
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  updatedAt: string;
  skills: VolunteerProfileSkill[];
};

export async function getVolunteerProfile(): Promise<VolunteerProfile> {
  const res = await authFetch(`${API_BASE}/volunteer-profiles/me`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to load volunteer profile";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

export type UpdateVolunteerProfileBody = {
  availabilityRadiusKm?: number;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  skillIds?: string[];
};

export async function updateVolunteerProfile(
  body: UpdateVolunteerProfileBody,
): Promise<VolunteerProfile> {
  const res = await authFetch(`${API_BASE}/volunteer-profiles/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to update profile";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

export type UpdateAvailabilityBody = {
  isAvailable: boolean;
  latitude?: number;
  longitude?: number;
};

export async function updateAvailability(
  body: UpdateAvailabilityBody,
): Promise<VolunteerProfile> {
  const res = await authFetch(`${API_BASE}/volunteer-profiles/me/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to update availability";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

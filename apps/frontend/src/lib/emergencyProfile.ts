import { API_BASE, authFetch } from "./api";

export type EmergencyContactInput = {
  name: string;
  phone: string;
  relationship?: string;
  isPrimary?: boolean;
};

export type EmergencyContact = EmergencyContactInput & { id: string };

export type EmergencyProfile = {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  medicalConditions?: string | null;
  medications?: string | null;
  consentGivenAt: string;
  contacts: EmergencyContact[];
};

export type CreateEmergencyProfileBody = {
  fullName: string;
  dateOfBirth?: string;
  bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  consentGivenAt: string;
  contacts?: EmergencyContactInput[];
};

export async function createEmergencyProfile(
  body: CreateEmergencyProfileBody
): Promise<EmergencyProfile> {
  const res = await authFetch(`${API_BASE}/emergency-profiles/me`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to save emergency profile.");
  }
  return json?.data ?? json;
}

export async function getMyEmergencyProfile(): Promise<EmergencyProfile | null> {
  const res = await authFetch(`${API_BASE}/emergency-profiles/me`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function updateEmergencyProfile(
  body: Partial<CreateEmergencyProfileBody>,
): Promise<EmergencyProfile> {
  const res = await authFetch(`${API_BASE}/emergency-profiles/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update emergency profile.");
  return json?.data ?? json;
}

export async function getEmergencyProfileById(profileId: string): Promise<EmergencyProfile | null> {
  const res = await authFetch(`${API_BASE}/emergency-profiles/${profileId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

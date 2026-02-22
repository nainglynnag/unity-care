import { API_BASE, authFetch } from "./api";

export type EmergencyContactInput = {
  name: string;
  phone: string;
  relationship?: string;
  isPrimary?: boolean;
};

export type CreateEmergencyProfileBody = {
  fullName: string;
  dateOfBirth?: string;
  bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  consentGivenAt: string; // ISO date
  contacts?: EmergencyContactInput[];
};

export async function createEmergencyProfile(
  body: CreateEmergencyProfileBody
): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/emergency-profiles/me`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.meta?.message ??
      "Failed to save emergency profile.";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

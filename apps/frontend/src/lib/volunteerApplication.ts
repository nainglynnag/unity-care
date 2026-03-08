import { API_BASE, authFetch } from "./api";

export type Agency = { id: string; name: string; region: string | null };
export type Skill = { id: string; name: string };

export type SubmitApplicationBody = {
  agencyId: string;
  skillIds: string[];
  dateOfBirth: string; // ISO date
  nationalIdNumber: string;
  nationalIdUrl: string;
  address: string;
  hasTransport: boolean;
  experience?: string;
  consentGiven: boolean;
  certificates?: Array<{
    name: string;
    fileUrl: string;
    issuedBy?: string;
    issuedAt?: string;
  }>;
};

export async function getAgencies(): Promise<Agency[]> {
  const res = await authFetch(`${API_BASE}/agencies`);
  if (!res.ok) throw new Error("Failed to load agencies");
  const json = await res.json();
  return json?.data?.agencies ?? [];
}

export async function getSkills(): Promise<Skill[]> {
  const res = await authFetch(`${API_BASE}/skills`);
  if (!res.ok) throw new Error("Failed to load skills");
  const json = await res.json();
  return json?.data?.skills ?? [];
}

export async function submitVolunteerApplication(
  body: SubmitApplicationBody,
): Promise<{ id: string; status: string; [key: string]: unknown }> {
  const res = await authFetch(`${API_BASE}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.error?.details?.map((d: { message: string }) => d.message).join(" ") ||
      "Failed to submit application";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

export async function getMyApplications(): Promise<
  Array<{ id: string; status: string; agency?: { id: string; name: string }; [key: string]: unknown }>
> {
  const res = await authFetch(`${API_BASE}/applications/me`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || "Failed to load applications";
    throw new Error(msg);
  }
  const data = json?.data;
  return Array.isArray(data) ? data : data?.applications ?? [];
}

export async function getApplicationDetail(
  applicationId: string,
): Promise<Record<string, unknown> | null> {
  const res = await authFetch(`${API_BASE}/applications/${applicationId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function withdrawApplication(
  applicationId: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/applications/${applicationId}/withdraw`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ?? "Failed to withdraw application",
    );
  }
}

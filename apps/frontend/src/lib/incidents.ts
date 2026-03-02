import { API_BASE, authFetch } from "./api";

export type IncidentCategory = {
  id: string;
  name: string;
  description: string | null;
};

export type CreateIncidentBody = {
  title: string;
  categoryId?: string;
  latitude: number;
  longitude: number;
  forSelf: boolean;
  description?: string;
  addressText?: string;
  landmark?: string;
  accuracy?: "GPS" | "MANUAL" | "VERIFIED";
  reporterNote?: string;
  media?: { url: string; mediaType: "IMAGE" | "VIDEO" | "AUDIO" }[];
};

export type CreateIncidentResponse = {
  incident: {
    id: string;
    title: string;
    status: string;
    latitude: number;
    longitude: number;
    category: { id: string; name: string };
    reporter: { id: string; name: string; email: string };
    media?: { id: string; url: string; mediaType: string }[];
  };
};

export type IncidentMissionAssignment = {
  role: string;
  assignee: { id: string; name: string };
};
export type IncidentMission = {
  id: string;
  status: string;
  missionType?: string;
  assignments?: IncidentMissionAssignment[];
};
export type IncidentDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  addressText?: string | null;
  category: { id: string; name: string };
  reporter?: { id: string; name: string; email: string };
  media?: { id: string; url: string; mediaType: string }[];
  missions?: IncidentMission[];
};

export async function getIncidentCategories(): Promise<IncidentCategory[]> {
  const res = await authFetch(`${API_BASE}/incidents/categories`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

export async function getIncident(incidentId: string): Promise<IncidentDetail | null> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function createIncident(
  body: CreateIncidentBody
): Promise<CreateIncidentResponse> {
  const res = await authFetch(`${API_BASE}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.meta?.message ??
      "Failed to create incident";
    throw new Error(msg);
  }
  return json?.data ?? json;
}

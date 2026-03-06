import { API_BASE, authFetch } from "./api";
import {
  getCompletedMissionPrimaryIncidentIds,
  getAgencyMissionPrimaryIncidentIds,
} from "./missions";

export type IncidentCategory = {
  id: string;
  name: string;
  description: string | null;
};

export type CreateIncidentBody = {
  title: string;
  categoryId: string;
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
  assignee: { id: string; name: string; email?: string; phone?: string | null; profileImageUrl?: string | null };
};
export type IncidentMission = {
  id: string;
  status: string;
  missionType?: string;
  assignments?: IncidentMissionAssignment[];
  tracking?: { latitude: number; longitude: number; recordedAt: string; volunteer: { id: string; name: string } }[];
  logs?: { action: string; note: string | null; createdAt: string; actor?: { id: string; name: string } | null }[];
  report?: { id: string; summary: string; submittedAt: string } | null;
};
export type IncidentDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  addressText?: string | null;
  landmark?: string | null;
  category: { id: string; name: string };
  reporter?: {
    id: string;
    name: string;
    email?: string;
    phone?: string | null;
    emergencyProfile?: { contacts: { name: string; phone: string; isPrimary?: boolean }[] };
  };
  media?: { id: string; url: string; mediaType: string }[];
  missions?: IncidentMission[];
  verifications?: { id: string; decision: string | null; comment: string | null; createdAt: string; verifier: { id: string; name: string; email: string } }[];
  _count?: { verifications: number; media: number; missions: number };
};

export type NearbyIncident = {
  id: string;
  title: string;
  status: string;
  addressText?: string | null;
  category?: { id: string; name: string } | null;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
};

export type NearbyIncidentsResult = {
  incidents: NearbyIncident[];
  totalRecords: number;
};

// Assigned incidents for volunteer validation view
export type AssignedIncident = {
  verificationId: string;
  assignedAt: string;
  assignedBy: { id: string; name: string } | null;
  submittedAt: string | null;
  decision: "VERIFIED" | "UNREACHABLE" | "FALSE_REPORT" | null;
  comment: string | null;
  isConfirmed: boolean | null;
  confirmedAt: string | null;
  confirmNote: string | null;
  incident: {
    id: string;
    title: string;
    status: string;
    latitude: number;
    longitude: number;
    addressText?: string | null;
    landmark?: string | null;
    description?: string | null;
    category?: { id?: string; name?: string | null } | null;
    reporter?: { id: string; name: string } | null;
    media?: { id: string; url: string; mediaType: string }[];
    _count?: { missions: number };
  };
};

export async function getIncidentCategories(): Promise<IncidentCategory[]> {
  const res = await authFetch(`${API_BASE}/incidents/categories`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

export async function getIncident(
  incidentId: string,
  options?: { signal?: AbortSignal },
): Promise<IncidentDetail | null> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}`, {
    signal: options?.signal,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// List incidents (GET /incidents). Matches listIncidentQuerySchema.
// When lat/lng are provided, uses Haversine geo filtering; sortBy=distance orders by nearest.
export async function getNearbyIncidents(params: {
  status?: string;
  categoryId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: "createdAt" | "distance";
  page?: number;
  perPage?: number;
}): Promise<NearbyIncidentsResult> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.categoryId) search.set("categoryId", params.categoryId);
  search.set("sortBy", params?.sortBy ?? "createdAt");
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 10));
  if (params?.lat != null && params?.lng != null) {
    search.set("lat", String(params.lat));
    search.set("lng", String(params.lng));
    if (params?.radiusKm != null) search.set("radiusKm", String(params.radiusKm));
  }

  const res = await authFetch(`${API_BASE}/incidents?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.meta?.message ?? "Failed to load nearby incidents";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }

  const data = json?.data;
  const list: NearbyIncident[] = Array.isArray(data) ? (data as NearbyIncident[]) : [];
  const totalRecords = typeof json?.meta?.pagination?.totalRecords === "number" ? json.meta.pagination.totalRecords : list.length;
  return { incidents: list, totalRecords };
}

// Incidents assigned to the current volunteer for verification (GET /incidents/assigned).
// Matches listAssignedIncidentsQuerySchema: status, page, perPage.
export async function getAssignedIncidents(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<AssignedIncident[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  qs.set("page", String(params?.page ?? 1));
  qs.set("perPage", String(params?.perPage ?? 20));
  const res = await authFetch(`${API_BASE}/incidents/assigned?${qs.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? (data as AssignedIncident[]) : [];
}

/**
 * Same as getAssignedIncidents but excludes assignments whose incident
 * is the primary incident of a COMPLETED or CLOSED mission (so validation
 * doesn’t show “Create Mission” for finished work). Filtering is done
 * on the frontend using the current user’s completed/closed missions.
 */
export async function getAssignedIncidentsFiltered(agencyId?: string): Promise<AssignedIncident[]> {
  const [assignments, myIds, agencyMissionIds] = await Promise.all([
    getAssignedIncidents(),
    getCompletedMissionPrimaryIncidentIds(),
    agencyId ? getAgencyMissionPrimaryIncidentIds(agencyId) : Promise.resolve(new Set<string>()),
  ]);
  const excludeIds = new Set([...myIds, ...agencyMissionIds]);
  return assignments.filter((a) => !excludeIds.has(a.incident.id));
}

/**
 * Fetches nearby REPORTED and VERIFIED incidents (same as Validation page
 * merge), then removes VERIFIED incidents that are the primary incident
 * of a COMPLETED or CLOSED mission so they don’t still show on the map.
 * Filtering is done on the frontend using the current user’s completed/closed missions.
 */
export async function getNearbyIncidentsFiltered(params: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  perPage?: number;
  agencyId?: string;
}): Promise<NearbyIncidentsResult> {
  const { agencyId, ...rest } = params;
  const [reported, verified, myIds, agencyMissionIds] = await Promise.all([
    getNearbyIncidents({ ...rest, status: "REPORTED" }),
    getNearbyIncidents({ ...rest, status: "VERIFIED" }),
    getCompletedMissionPrimaryIncidentIds(),
    agencyId ? getAgencyMissionPrimaryIncidentIds(agencyId) : Promise.resolve(new Set<string>()),
  ]);
  const excludeIds = new Set([...myIds, ...agencyMissionIds]);
  const seen = new Set<string>();
  const merged: NearbyIncident[] = [];
  for (const inc of [...reported.incidents, ...verified.incidents]) {
    if (seen.has(inc.id)) continue;
    seen.add(inc.id);
    if (inc.status === "VERIFIED" && excludeIds.has(inc.id)) continue;
    merged.push(inc);
  }
  return { incidents: merged, totalRecords: merged.length };
}

/** Volunteer self-assigns as verifier for a REPORTED incident via PATCH /incidents/:id/assign-verifier. */
export async function acceptIncidentForVerification(
  incidentId: string,
): Promise<void> {
  const user = (await import("./api")).getCurrentUser();
  if (!user?.id) throw new Error("Not signed in");

  const res = await authFetch(
    `${API_BASE}/incidents/${incidentId}/assign-verifier`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId: user.id }),
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ??
        json?.meta?.message ??
        "Failed to accept incident for verification",
    );
  }
}

export async function submitVerification(
  incidentId: string,
  data: {
    decision: "VERIFIED" | "UNREACHABLE" | "FALSE_REPORT";
    comment?: string;
    media?: { url: string; mediaType: "IMAGE" | "VIDEO" | "AUDIO" }[];
  },
): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, media: data.media ?? [] }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ??
        json?.meta?.message ??
        "Failed to submit verification",
    );
  }
}

// ── Civilian: my incidents ──

export type MyIncident = {
  id: string;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  addressText?: string | null;
  description?: string | null;
  category?: { id: string; name: string } | null;
  createdAt: string;
};

export type MyIncidentsResult = {
  incidents: MyIncident[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getMyIncidents(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<MyIncidentsResult> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  qs.set("page", String(params?.page ?? 1));
  qs.set("perPage", String(params?.perPage ?? 10));
  const res = await authFetch(`${API_BASE}/incidents/me?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to load your incidents";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }
  const data = json?.data;
  const list: MyIncident[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    incidents: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export async function closeIncident(incidentId: string, note: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/close`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to close incident");
  }
}

export async function resolveIncident(incidentId: string, note: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to resolve incident");
  }
}

// ── Verification pipeline (Coordinator / Director) ──

export async function confirmVerification(
  incidentId: string,
  confirmed: boolean,
  confirmNote?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/verification/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed, ...(confirmNote ? { confirmNote } : {}) }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to confirm verification");
  }
}

export async function retryVerification(incidentId: string, volunteerId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/verification/retry`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volunteerId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to retry verification");
  }
}

export type Verification = {
  id: string;
  decision: string | null;
  comment: string | null;
  isConfirmed: boolean | null;
  confirmNote: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  assignedAt: string;
  volunteer: { id: string; name: string };
};

export async function getVerifications(incidentId: string): Promise<Verification[]> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/verifications`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

export async function updateIncidentStatus(incidentId: string, status: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to update incident status");
  }
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
    const msg = json?.error?.message ?? json?.meta?.message ?? "Failed to create incident";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }
  return json?.data ?? json;
}

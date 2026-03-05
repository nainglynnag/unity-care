import { API_BASE, authFetch } from "./api";

export type MissionAssignment = {
  id: string;
  role: string;
  assignedTo: string;
  assignedAt?: string;
  assignee: { id: string; name: string };
};

export type MissionLog = {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  actor?: { id: string; name: string } | null;
};

/** MissionIncident: links additional incidents to a mission (duplicate reports) */
export type MissionIncident = {
  missionId: string;
  incidentId: string;
  linkedAt: string;
  incident: { id: string; title: string; status: string };
};

export type AssignedMission = {
  id: string;
  status: string;
  missionType: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
  acceptedAt: string | null;
  onSiteAt: string | null;
  completedAt: string | null;
  closedAt?: string | null;
  primaryIncident: {
    id: string;
    title: string;
    status: string;
    latitude: number;
    longitude: number;
    addressText?: string | null;
    description?: string | null;
    category?: { id: string; name: string } | null;
  };
  assignments: MissionAssignment[];
  linkedIncidents?: MissionIncident[];
  agency?: { id: string; name: string } | null;
  logs?: MissionLog[];
};

export type MissionReport = {
  id: string;
  summary: string;
  actionsTaken?: string | null;
  resourcesUsed?: string | null;
  casualties?: number | null;
  propertyDamage?: string | null;
  submittedBy: string;
  submittedAt: string;
};

export type MissionTrackingPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  volunteer: { id: string; name: string };
};

export type MissionDetail = AssignedMission & {
  report?: MissionReport | null;
  tracking?: MissionTrackingPoint[];
};

export type MissionsListResult = {
  missions: AssignedMission[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getAssignedMissions(): Promise<AssignedMission[]> {
  const res = await authFetch(`${API_BASE}/missions/assigned`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? (data as AssignedMission[]) : [];
}

export async function listAssignedMissions(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<MissionsListResult> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 20));

  const res = await authFetch(`${API_BASE}/missions/assigned?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    return { missions: [], totalRecords: 0, totalPages: 0, currentPage: 1 };
  }
  const data = json?.data;
  const list: AssignedMission[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    missions: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export async function getMission(missionId: string): Promise<MissionDetail | null> {
  const res = await authFetch(`${API_BASE}/missions/${missionId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function acceptMission(missionId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/missions/${missionId}/accept`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ?? json?.meta?.message ?? "Failed to accept mission",
    );
  }
}

export async function rejectMission(
  missionId: string,
  note?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/missions/${missionId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note ?? "Volunteer declined the mission." }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ??
        json?.meta?.message ??
        "Failed to decline mission",
    );
  }
}

async function missionAction(
  missionId: string,
  action: string,
  method: "PATCH" | "POST",
  body?: Record<string, unknown>,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/missions/${missionId}/${action}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      json?.error?.message ?? json?.meta?.message ?? `Failed: ${action}`,
    );
  }
}

export async function startTravel(
  missionId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await missionAction(missionId, "start-travel", "PATCH", { latitude, longitude });
}

export async function arriveOnSite(
  missionId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await missionAction(missionId, "arrive", "PATCH", { latitude, longitude });
}

export async function startWork(
  missionId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await missionAction(missionId, "start-work", "PATCH", { latitude, longitude });
}

export async function submitCompletionReport(
  missionId: string,
  data: {
    latitude: number;
    longitude: number;
    summary: string;
    actionsTaken?: string;
    resourcesUsed?: string;
    casualties?: number;
    propertyDamage?: string;
  },
): Promise<void> {
  await missionAction(missionId, "completion-report", "POST", data);
}

export async function reportFailure(
  missionId: string,
  reason: string,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  await missionAction(missionId, "report-failure", "PATCH", {
    reason,
    ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
  });
}

export async function createMission(data: {
  primaryIncidentId: string;
  linkedIncidentIds?: string[];
  missionType: string;
  priority: string;
  volunteers: { volunteerId: string; role: "LEADER" | "MEMBER" }[];
}): Promise<MissionDetail> {
  const res = await authFetch(`${API_BASE}/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to create mission");
  }
  return json?.data ?? json;
}

export async function listMissions(params?: {
  status?: string;
  priority?: string;
  agencyId?: string;
  incidentId?: string;
  page?: number;
  perPage?: number;
}): Promise<MissionsListResult> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.priority) qs.set("priority", params.priority);
  if (params?.agencyId) qs.set("agencyId", params.agencyId);
  if (params?.incidentId) qs.set("incidentId", params.incidentId);
  qs.set("page", String(params?.page ?? 1));
  qs.set("perPage", String(params?.perPage ?? 20));

  const res = await authFetch(`${API_BASE}/missions?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    return { missions: [], totalRecords: 0, totalPages: 0, currentPage: 1 };
  }
  const data = json?.data;
  const list: AssignedMission[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    missions: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export async function confirmCompletion(
  missionId: string,
  confirmed: boolean,
  note?: string,
): Promise<void> {
  await missionAction(missionId, "confirm-completion", "PATCH", {
    confirmed,
    ...(note ? { note } : {}),
  });
}

export async function agencyDecision(
  missionId: string,
  decision: "CONTINUE" | "FAIL",
  volunteerId?: string,
  note?: string,
): Promise<void> {
  await missionAction(missionId, "agency-decision", "PATCH", {
    decision,
    ...(volunteerId ? { volunteerId } : {}),
    ...(note ? { note } : {}),
  });
}

export async function cancelMission(
  missionId: string,
  note: string,
): Promise<void> {
  await missionAction(missionId, "cancel", "PATCH", { note });
}

export async function pushTracking(
  missionId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await missionAction(missionId, "tracking", "POST", { latitude, longitude });
}

export async function getTrackingHistory(
  missionId: string,
  params?: { volunteerId?: string; since?: string; limit?: number },
): Promise<MissionTrackingPoint[]> {
  const qs = new URLSearchParams();
  if (params?.volunteerId) qs.set("volunteerId", params.volunteerId);
  if (params?.since) qs.set("since", params.since);
  if (params?.limit) qs.set("limit", String(params.limit));
  const url = `${API_BASE}/missions/${missionId}/tracking${qs.toString() ? `?${qs}` : ""}`;
  const res = await authFetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

export async function getTrackingLatest(
  missionId: string,
): Promise<MissionTrackingPoint[]> {
  const res = await authFetch(`${API_BASE}/missions/${missionId}/tracking/latest`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

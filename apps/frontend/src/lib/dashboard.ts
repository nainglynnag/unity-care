import { API_BASE, authFetch } from "./api";

// ── Volunteer Dashboard ──

export type VolunteerSummary = {
  period: string;
  isAvailable: boolean;
  missions: {
    current: number;
    previous: number;
    delta: number;
    breakdown: {
      closed: number;
      failed: number;
      cancelled: number;
      active: number;
    };
  };
  successRate: {
    current: number;
    previous: number;
    delta: number;
  };
  hoursServed: number;
  avgMissionDurationHours: number;
};

export async function getVolunteerSummary(period = "30d"): Promise<VolunteerSummary> {
  const res = await authFetch(`${API_BASE}/dashboard/volunteer/summary?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load volunteer summary");
  return json?.data ?? json;
}

export async function getVolunteerMissionsDashboard(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/volunteer/missions?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load missions dashboard");
  return json?.data ?? json;
}

export async function getVolunteerVerificationsDashboard(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/volunteer/verifications?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load verifications dashboard");
  return json?.data ?? json;
}

// ── Agency Dashboard ──

export async function getAgencyLive(agencyId?: string): Promise<unknown> {
  const qs = agencyId ? `?agencyId=${agencyId}` : "";
  const res = await authFetch(`${API_BASE}/dashboard/agency/live${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency live data");
  return json?.data ?? json;
}

export async function getAgencyIncidentsDashboard(period = "30d", agencyId?: string): Promise<unknown> {
  const qs = new URLSearchParams({ period });
  if (agencyId) qs.set("agencyId", agencyId);
  const res = await authFetch(`${API_BASE}/dashboard/agency/incidents?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency incidents");
  return json?.data ?? json;
}

export async function getAgencyMissionsDashboard(period = "30d", agencyId?: string): Promise<unknown> {
  const qs = new URLSearchParams({ period });
  if (agencyId) qs.set("agencyId", agencyId);
  const res = await authFetch(`${API_BASE}/dashboard/agency/missions?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency missions");
  return json?.data ?? json;
}

export async function getAgencyVolunteersDashboard(period = "30d", agencyId?: string): Promise<unknown> {
  const qs = new URLSearchParams({ period });
  if (agencyId) qs.set("agencyId", agencyId);
  const res = await authFetch(`${API_BASE}/dashboard/agency/volunteers?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency volunteers");
  return json?.data ?? json;
}

export async function getAgencyCategoriesDashboard(period = "30d", agencyId?: string): Promise<unknown> {
  const qs = new URLSearchParams({ period });
  if (agencyId) qs.set("agencyId", agencyId);
  const res = await authFetch(`${API_BASE}/dashboard/agency/categories?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency categories");
  return json?.data ?? json;
}

export async function getAgencyApplicationsDashboard(period = "30d", agencyId?: string): Promise<unknown> {
  const qs = new URLSearchParams({ period });
  if (agencyId) qs.set("agencyId", agencyId);
  const res = await authFetch(`${API_BASE}/dashboard/agency/applications?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agency applications");
  return json?.data ?? json;
}

// ── Admin Dashboard ──

export async function getAdminRetention(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/retention?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load retention data");
  return json?.data ?? json;
}

export async function getAdminHealth(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/health?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load health data");
  return json?.data ?? json;
}

export async function getAdminAgencies(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/agencies?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load agencies dashboard");
  return json?.data ?? json;
}

export async function getAdminApplicationsDashboard(period = "30d"): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/applications?period=${period}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load applications dashboard");
  return json?.data ?? json;
}

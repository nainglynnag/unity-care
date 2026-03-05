import { API_BASE, authFetch } from "./api";

export type AgencyRole = "MEMBER" | "COORDINATOR" | "DIRECTOR";

export type AgencyMembership = {
  agencyId: string;
  agencyName: string;
  myRole: AgencyRole;
};

/**
 * Fetches GET /auth/me which returns agencyMemberships[].
 * Returns the first membership found, or null if the user has none.
 */
export async function getMyAgencyMembership(): Promise<AgencyMembership | null> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data ?? json;
  const memberships: { role: AgencyRole; agency: { id: string; name: string } }[] =
    data?.agencyMemberships ?? [];
  if (memberships.length === 0) return null;
  const m = memberships[0];
  return {
    agencyId: m.agency.id,
    agencyName: m.agency.name,
    myRole: m.role,
  };
}

export type TeamMember = {
  userId: string;
  name: string;
  profileImageUrl: string | null;
  isAvailable: boolean;
  availabilityRadiusKm: number | null;
  role: AgencyRole;
  skills: { id: string; name: string }[];
};

export type TeamListResult = {
  members: TeamMember[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getTeamMembers(
  agencyId: string,
  params?: { search?: string; page?: number; perPage?: number },
): Promise<TeamListResult> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  qs.set("page", String(params?.page ?? 1));
  qs.set("perPage", String(params?.perPage ?? 50));

  const res = await authFetch(`${API_BASE}/agencies/${agencyId}/volunteers?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load team members");
  }
  const body = json?.data ?? json;
  const pagination = json?.meta?.pagination;
  return {
    members: Array.isArray(body.volunteers) ? body.volunteers : Array.isArray(body) ? body : [],
    totalRecords: pagination?.totalRecords ?? body.volunteers?.length ?? 0,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export type UpdatedMember = {
  agencyId: string;
  userId: string;
  role: AgencyRole;
  joinedAt: string;
  user: { id: string; name: string; email: string };
};

export async function updateMemberRole(
  agencyId: string,
  volunteerId: string,
  role: AgencyRole,
): Promise<UpdatedMember> {
  const res = await authFetch(`${API_BASE}/agencies/${agencyId}/volunteers/${volunteerId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to update role");
  }
  return json?.data ?? json;
}

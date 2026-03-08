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
const ROLE_PRIORITY: Record<string, number> = { DIRECTOR: 3, COORDINATOR: 2, MEMBER: 1 };

export async function getMyAgencyMembership(): Promise<AgencyMembership | null> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data ?? json;
  const memberships: { role: AgencyRole; agency: { id: string; name: string } }[] =
    data?.agencyMemberships ?? [];
  if (memberships.length === 0) return null;
  const sorted = [...memberships].sort(
    (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0),
  );
  const m = sorted[0];
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
  lastKnownLatitude?: number | null;
  lastKnownLongitude?: number | null;
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
  params?: { search?: string; skillId?: string; page?: number; perPage?: number },
): Promise<TeamListResult> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.skillId) qs.set("skillId", params.skillId);
  qs.set("page", String(params?.page ?? 1));
  qs.set("perPage", String(params?.perPage ?? 50));

  const res = await authFetch(`${API_BASE}/agencies/${agencyId}/volunteers?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to load team members";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }
  // Backend paginatedResponse sends data = volunteers array
  const body = json?.data ?? json;
  const pagination = json?.meta?.pagination;
  const members = Array.isArray(body) ? body : Array.isArray(body?.volunteers) ? body.volunteers : [];
  return {
    members,
    totalRecords: pagination?.totalRecords ?? members.length,
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
    const msg = json?.error?.message ?? "Failed to update role";
    const code = json?.error?.code;
    const details = json?.error?.details;
    const fullMsg = Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg;
    const err = new Error(fullMsg) as Error & { code?: string };
    err.code = code;
    throw err;
  }
  return json?.data ?? json;
}

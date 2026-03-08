import { API_BASE, authFetch } from "./api";

// ── Users ──

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
  lastLoginAt: string | null;
};

export type UsersListResult = {
  users: AdminUser[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getUsers(params?: {
  role?: string;
  isActive?: string;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<UsersListResult> {
  const search = new URLSearchParams();
  if (params?.role) search.set("role", params.role);
  if (params?.isActive) search.set("isActive", params.isActive);
  if (params?.search) search.set("search", params.search);
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 20));

  const res = await authFetch(`${API_BASE}/users?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load users");
  }
  const data = json?.data;
  const list: AdminUser[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    users: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export async function toggleUserStatus(
  userId: string,
  isActive: boolean,
  reason?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive, ...(reason ? { reason } : {}) }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to update user status");
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
  confirmNewPassword: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${userId}/password/reset`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword, confirmNewPassword }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to reset password");
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to delete user");
  }
}

// ── Applications ──

export type AdminApplication = {
  id: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  applicant: { id: string; name: string; email?: string };
  agency: { id: string; name: string; region?: string | null };
  reviewer?: { id: string; name: string } | null;
  _count?: { certificates: number };
};

export type ApplicationsListResult = {
  applications: AdminApplication[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getApplications(params?: {
  status?: string;
  agencyId?: string;
  page?: number;
  perPage?: number;
}): Promise<ApplicationsListResult> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.agencyId) search.set("agencyId", params.agencyId);
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 20));

  const res = await authFetch(`${API_BASE}/applications?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load applications");
  }
  const data = json?.data;
  const list: AdminApplication[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    applications: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

export async function startReview(applicationId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/applications/${applicationId}/start-review`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to start review");
  }
}

export async function reviewApplication(
  applicationId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/applications/${applicationId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, ...(reviewNote ? { reviewNote } : {}) }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to review application");
  }
}

// ── Dashboard ──

export type PeriodDelta = {
  current: number;
  previous: number;
  changePercent: number;
};

export type AdminOverview = {
  period: string;
  civilians: PeriodDelta;
  volunteers: PeriodDelta;
  incidents: PeriodDelta;
  missions: PeriodDelta;
  totalAgencies: number;
  missionSuccessRate: number;
};

export async function getAdminOverview(period: string = "30d"): Promise<AdminOverview> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/overview?period=${period}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load admin overview");
  }
  return json?.data ?? json;
}

export type AdminHealth = {
  period: string;
  registrationTrend: { bucket: string; civilians: number; volunteers: number }[];
};

export async function getAdminHealth(period: string = "30d"): Promise<AdminHealth> {
  const res = await authFetch(`${API_BASE}/dashboard/admin/health?period=${period}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load health");
  }
  const data = json?.data ?? json;
  return {
    period: data?.period ?? period,
    registrationTrend: Array.isArray(data?.registrationTrend) ? data.registrationTrend : [],
  };
}

// ── Agencies ──

export type Agency = {
  id: string;
  name: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: string | null;
  isActive?: boolean;
  createdAt?: string;
  memberCount?: number;
};

export type AgenciesListResult = {
  agencies: Agency[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getAgencies(params?: {
  search?: string;
  isActive?: boolean;
  region?: string;
  page?: number;
  perPage?: number;
}): Promise<AgenciesListResult> {
  const search = new URLSearchParams();
  if (params?.search) search.set("search", params.search);
  if (params?.isActive !== undefined) search.set("isActive", String(params.isActive));
  if (params?.region) search.set("region", params.region);
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 100));

  const res = await authFetch(`${API_BASE}/agencies?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to load agencies";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }
  const data = json?.data;
  // Backend paginatedResponse sends data = agencies array
  const list: Agency[] = Array.isArray(data)
    ? data
    : data?.agencies && Array.isArray(data.agencies)
      ? data.agencies
      : [];
  const pagination = json?.meta?.pagination;
  return {
    agencies: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

// ── Agency Volunteers ──

export type AgencyVolunteer = {
  userId: string;
  name: string;
  profileImageUrl: string | null;
  isAvailable: boolean;
  availabilityRadiusKm: number | null;
  lastKnownLatitude?: number | null;
  lastKnownLongitude?: number | null;
  role?: AgencyRole;
  skills: { id: string; name: string }[];
};

export type AgencyVolunteersResult = {
  agencyId: string;
  volunteers: AgencyVolunteer[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
};

export async function getAgencyVolunteers(
  agencyId: string,
  params?: { search?: string; skillId?: string; page?: number; perPage?: number },
): Promise<AgencyVolunteersResult> {
  const search = new URLSearchParams();
  if (params?.search) search.set("search", params.search);
  if (params?.skillId) search.set("skillId", params.skillId);
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 50));

  const res = await authFetch(`${API_BASE}/agencies/${agencyId}/volunteers?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? "Failed to load volunteers";
    const details = json?.error?.details;
    throw new Error(Array.isArray(details) && details.length > 0 ? `${msg}: ${details.map((d: { message?: string }) => d?.message ?? d).join("; ")}` : msg);
  }
  // Backend paginatedResponse sends data = volunteers array (controller passes result.volunteers)
  const body = json?.data ?? json;
  const pagination = json?.meta?.pagination;
  const volunteers = Array.isArray(body) ? body : Array.isArray(body?.volunteers) ? body.volunteers : [];
  return {
    agencyId: body?.agencyId ?? agencyId,
    volunteers,
    totalRecords: pagination?.totalRecords ?? volunteers.length,
    totalPages: pagination?.totalPages ?? 1,
    currentPage: pagination?.currentPage ?? 1,
  };
}

// ── Update Member Role ──

export type AgencyRole = "MEMBER" | "COORDINATOR" | "DIRECTOR";

export type UpdatedMember = {
  agencyId: string;
  userId: string;
  role: AgencyRole;
  joinedAt: string;
  user: { id: string; name: string; email: string };
};

export async function updateVolunteerRole(
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

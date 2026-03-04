import { API_BASE, authFetch } from "./api";

// ── Skills ──

export type Skill = { id: string; name: string; description?: string | null; isActive: boolean };

export async function getSkills(): Promise<Skill[]> {
  const res = await authFetch(`${API_BASE}/skills`);
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

export async function createSkill(data: { name: string; description?: string }): Promise<Skill> {
  const res = await authFetch(`${API_BASE}/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to create skill");
  return json?.data ?? json;
}

export async function updateSkill(id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<Skill> {
  const res = await authFetch(`${API_BASE}/skills/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update skill");
  return json?.data ?? json;
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/skills/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to delete skill");
  }
}

// ── Categories ──

export type Category = { id: string; name: string; description?: string | null; isActive: boolean };

export async function getCategories(): Promise<Category[]> {
  const res = await authFetch(`${API_BASE}/categories`);
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

export async function createCategory(data: { name: string; description?: string }): Promise<Category> {
  const res = await authFetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to create category");
  return json?.data ?? json;
}

export async function updateCategory(id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<Category> {
  const res = await authFetch(`${API_BASE}/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update category");
  return json?.data ?? json;
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to delete category");
  }
}

// ── Agencies CRUD ──

export type AgencyDetail = {
  id: string;
  name: string;
  description?: string | null;
  region?: string | null;
  isActive: boolean;
};

export async function getAgencyDetail(id: string): Promise<AgencyDetail | null> {
  const res = await authFetch(`${API_BASE}/agencies/${id}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

export async function createAgency(data: { name: string; description?: string; region?: string }): Promise<AgencyDetail> {
  const res = await authFetch(`${API_BASE}/agencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to create agency");
  return json?.data ?? json;
}

export async function updateAgency(id: string, data: { name?: string; description?: string; region?: string; isActive?: boolean }): Promise<AgencyDetail> {
  const res = await authFetch(`${API_BASE}/agencies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update agency");
  return json?.data ?? json;
}

export async function deleteAgency(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/agencies/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to delete agency");
  }
}

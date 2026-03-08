import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  AlertTriangle,
  Users,
  MoreVertical,
  X,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  getUsers,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  type AdminUser,
} from "@/lib/admin";
import toast from "react-hot-toast";

const ROLE_FILTERS = [
  { value: "", label: "All Roles" },
  { value: "CIVILIAN", label: "Civilian" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERADMIN", label: "Super Admin" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Status" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: "bg-purple-500/20 text-purple-400",
  ADMIN: "bg-blue-500/20 text-blue-400",
  VOLUNTEER: "bg-emerald-500/20 text-emerald-400",
  CIVILIAN: "bg-gray-600/30 text-gray-400",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers({
        role: roleFilter || undefined,
        isActive: statusFilter || undefined,
        search: searchQuery || undefined,
        page,
        perPage: 15,
      });
      setUsers(result.users);
      setTotalPages(result.totalPages);
      setTotalRecords(result.totalRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleToggleStatus = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      await toggleUserStatus(user.id, !user.isActive);
      toast.success(`User ${user.isActive ? "deactivated" : "activated"}`);
      setActionMenu(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setActionLoading(true);
    try {
      await resetUserPassword(resetModal.id, newPassword, newPassword);
      toast.success("Password reset successfully");
      setResetModal(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Permanently delete ${user.name}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await deleteUser(user.id);
      toast.success("User deleted");
      setActionMenu(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">USER MANAGEMENT</h1>
        <p className="text-white/50 text-sm mt-1">{totalRecords} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Users className="w-8 h-8 text-white/20" />
          <p className="text-white/50 text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">NAME</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">EMAIL</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ROLE</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">STATUS</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">LAST LOGIN</th>
                <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {users.map((u, idx) => (
                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-white/60">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE[u.role] ?? ROLE_BADGE.CIVILIAN}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}>
                      <span className={`w-2 h-2 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setActionMenu(actionMenu === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {actionMenu === u.id && (
                        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                      )}
                      {actionMenu === u.id && (
                        <div className="absolute right-0 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 py-1" style={{ top: idx >= users.length - 3 && users.length > 3 ? undefined : "100%", bottom: idx >= users.length - 3 && users.length > 3 ? "100%" : undefined, marginTop: idx >= users.length - 3 && users.length > 3 ? undefined : "4px", marginBottom: idx >= users.length - 3 && users.length > 3 ? "4px" : undefined }}>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={actionLoading}
                            className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-gray-800 flex items-center gap-2"
                          >
                            {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetModal(u); setActionMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-gray-800 flex items-center gap-2"
                          >
                            <KeyRound className="w-4 h-4" />
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={actionLoading}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs font-medium">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setResetModal(null)}>
          <div className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">Reset Password</h3>
              <button type="button" onClick={() => setResetModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm">
              Set a new password for <span className="text-white font-medium">{resetModal.name}</span>
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="px-4 py-2 text-sm text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={actionLoading || newPassword.length < 6}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

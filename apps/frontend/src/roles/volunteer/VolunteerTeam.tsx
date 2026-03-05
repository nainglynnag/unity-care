import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Users,
  Crown,
  Star,
  User,
  ChevronDown,
  Lock,
} from "lucide-react";
import {
  getMyAgencyMembership,
  getTeamMembers,
  updateMemberRole,
  type AgencyMembership,
  type AgencyRole,
  type TeamMember,
} from "@/lib/agencyTeam";
import { getCurrentUser } from "@/lib/api";
import toast from "react-hot-toast";

const ROLE_OPTIONS: { value: AgencyRole; label: string; icon: typeof Crown; color: string; bg: string }[] = [
  { value: "DIRECTOR", label: "Director", icon: Crown, color: "text-amber-400", bg: "bg-amber-500/20 text-amber-400" },
  { value: "COORDINATOR", label: "Coordinator", icon: Star, color: "text-blue-400", bg: "bg-blue-500/20 text-blue-400" },
  { value: "MEMBER", label: "Member", icon: User, color: "text-gray-400", bg: "bg-gray-600/30 text-gray-400" },
];

function getRoleBadge(role: AgencyRole) {
  return ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[2];
}

export default function VolunteerTeam() {
  const currentUser = getCurrentUser();

  const [membership, setMembership] = useState<AgencyMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isDirector = membership?.myRole === "DIRECTOR";
  const canChangeRoles = isDirector;
  const roleOptionsForCurrentUser = ROLE_OPTIONS;

  useEffect(() => {
    (async () => {
      try {
        const m = await getMyAgencyMembership();
        if (!m) {
          setMembershipError("You are not a member of any agency.");
        }
        setMembership(m);
      } catch {
        setMembershipError("Failed to load agency membership.");
      } finally {
        setMembershipLoading(false);
      }
    })();
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getTeamMembers(membership.agencyId, {
        search: searchQuery || undefined,
        page,
        perPage: 20,
      });
      setMembers(result.members);
      setTotalPages(result.totalPages);
      setTotalRecords(result.totalRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [membership, page, searchQuery]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleRoleChange = async (volunteerId: string, newRole: AgencyRole) => {
    if (!membership) return;
    setChangingRole(volunteerId);
    setOpenDropdown(null);
    try {
      await updateMemberRole(membership.agencyId, volunteerId, newRole);
      toast.success(`Role updated to ${newRole}`);
      await fetchMembers();
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "DIRECTOR_REQUIRED" || (e.message && e.message.includes("at least one director"))) {
        toast.error("Cannot demote the only director. Promote another member to Director first, then you can change this person's role.");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to update role");
      }
    } finally {
      setChangingRole(null);
    }
  };

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  if (membershipError || !membership) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users className="w-10 h-10 text-white/20" />
          <p className="text-white/50 text-sm text-center max-w-md">
            {membershipError ?? "No agency membership found."}
          </p>
        </div>
      </div>
    );
  }

  if (membership.myRole === "MEMBER") {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Lock className="w-10 h-10 text-white/30" />
          <p className="text-white/50 text-sm text-center max-w-md">
            Team is only available to Directors and Coordinators.
          </p>
          <Link
            to="/volunteer-dashboard"
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const badge = getRoleBadge(membership.myRole);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">TEAM</h1>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-white/50 text-sm">{membership.agencyName}</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}>
            <badge.icon className="w-3 h-3" />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search team members..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-red-500"
          />
        </div>
        <p className="text-white/40 text-xs">
          {totalRecords} member{totalRecords !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Users className="w-8 h-8 text-white/20" />
          <p className="text-white/50 text-sm">No members found.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">MEMBER</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">SKILLS</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">STATUS</th>
                <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ROLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {members.map((vol) => {
                const memberBadge = getRoleBadge(vol.role ?? "MEMBER");
                const isChanging = changingRole === vol.userId;
                const isOwnUser = vol.userId === currentUser?.id;

                return (
                  <tr key={vol.userId} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {vol.profileImageUrl ? (
                          <img src={vol.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                            <User className="w-4 h-4 text-white/40" />
                          </div>
                        )}
                        <span className="text-white font-medium">{vol.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {vol.skills.length === 0 ? (
                          <span className="text-white/30 text-xs">No skills</span>
                        ) : (
                          vol.skills.slice(0, 3).map((s) => (
                            <span key={s.id} className="px-2 py-0.5 rounded bg-gray-700/60 text-white/60 text-[10px] font-medium">
                              {s.name}
                            </span>
                          ))
                        )}
                        {vol.skills.length > 3 && (
                          <span className="text-white/30 text-[10px]">+{vol.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${vol.isAvailable ? "bg-emerald-400" : "bg-gray-500"}`} />
                        <span className={`text-xs font-medium ${vol.isAvailable ? "text-emerald-400" : "text-white/40"}`}>
                          {vol.isAvailable ? "Available" : "Unavailable"}
                        </span>
                        {vol.availabilityRadiusKm && (
                          <span className="text-white/30 text-[10px]">({vol.availabilityRadiusKm} km)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!canChangeRoles ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${memberBadge.bg}`}>
                          <memberBadge.icon className="w-3 h-3" />
                          {memberBadge.label}
                        </span>
                      ) : isChanging ? (
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          <span className="text-white/50 text-xs">Updating...</span>
                        </div>
                      ) : (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === vol.userId ? null : vol.userId)}
                            disabled={isOwnUser}
                            title={isOwnUser ? "Cannot change your own role" : "Change role"}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${memberBadge.bg} ${
                              isOwnUser ? "opacity-50 cursor-not-allowed" : "hover:brightness-125 cursor-pointer"
                            }`}
                          >
                            <memberBadge.icon className="w-3 h-3" />
                            {memberBadge.label}
                            {!isOwnUser && <ChevronDown className="w-3 h-3 ml-0.5" />}
                          </button>
                          {openDropdown === vol.userId && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                                {roleOptionsForCurrentUser.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleRoleChange(vol.userId, opt.value)}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                                  >
                                    <opt.icon className={`w-4 h-4 ${opt.color}`} />
                                    <span className="text-white/80">{opt.label}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}

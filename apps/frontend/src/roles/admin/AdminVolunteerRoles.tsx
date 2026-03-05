import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  UserCog,
  Building2,
  ChevronDown,
  Crown,
  Star,
  User,
} from "lucide-react";
import {
  getAgencies,
  getAgencyVolunteers,
  updateVolunteerRole,
  type Agency,
  type AgencyVolunteer,
  type AgencyRole,
} from "@/lib/admin";
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

export default function AdminVolunteerRoles() {
  const user = getCurrentUser();
  const isSuperadmin = user?.role === "SUPERADMIN";

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(true);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  const [volunteers, setVolunteers] = useState<AgencyVolunteer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getAgencies({ perPage: 100 });
        // Show all agencies except Default Agency; only hide those explicitly inactive (some APIs omit isActive)
        const list = result.agencies.filter(
          (a) => a.isActive !== false && a.name !== "Default Agency",
        );
        setAgencies(list);
        setSelectedAgencyId((prev) => (list.some((a) => a.id === prev) ? prev : ""));
      } catch {
        toast.error("Failed to load agencies");
      } finally {
        setAgenciesLoading(false);
      }
    })();
  }, []);

  const fetchVolunteers = useCallback(async () => {
    if (!selectedAgencyId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAgencyVolunteers(selectedAgencyId, {
        search: searchQuery || undefined,
        page,
        perPage: 20,
      });
      setVolunteers(result.volunteers);
      setTotalPages(result.totalPages);
      setTotalRecords(result.totalRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load volunteers");
      setVolunteers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAgencyId, page, searchQuery]);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleRoleChange = async (volunteerId: string, newRole: AgencyRole) => {
    setChangingRole(volunteerId);
    setOpenDropdown(null);
    try {
      await updateVolunteerRole(selectedAgencyId, volunteerId, newRole);
      toast.success(`Role updated to ${newRole}`);
      await fetchVolunteers();
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

  const selectedAgency = agencies.find((a) => a.id === selectedAgencyId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">VOLUNTEER ROLES</h1>
        <p className="text-white/50 text-sm mt-1">
          Promote available members to Director or Coordinator within an agency
        </p>
        <p className="text-white/40 text-xs mt-0.5">
          An agency must always have at least one Director. To change a director’s role, promote another member to Director first.
        </p>
      </div>

      {/* Agency selector */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white/70 text-xs font-semibold tracking-wider">
          <Building2 className="w-4 h-4" />
          SELECT AGENCY
        </div>
        {agenciesLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-white/50 text-sm">Loading agencies...</span>
          </div>
        ) : agencies.length === 0 ? (
          <p className="text-white/40 text-sm">No active agencies found.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agencies.map((agency) => (
              <button
                key={agency.id}
                type="button"
                onClick={() => {
                  setSelectedAgencyId(agency.id);
                  setPage(1);
                  setSearchQuery("");
                  setSearchInput("");
                  setVolunteers([]);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedAgencyId === agency.id
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                    : "bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700 border border-transparent"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {agency.name}
                {agency.memberCount != null && (
                  <span className="text-[10px] opacity-60">({agency.memberCount})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Volunteer list */}
      {selectedAgencyId && (
        <>
          {/* Search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search volunteers..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
              />
            </div>
            {selectedAgency && (
              <div className="text-right">
                <p className="text-white/40 text-xs">
                  {totalRecords} volunteer{totalRecords !== 1 ? "s" : ""} in{" "}
                  <span className="text-white/60 font-medium">{selectedAgency.name}</span>
                </p>
              </div>
            )}
          </div>

          {loading && volunteers.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          ) : volunteers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <UserCog className="w-8 h-8 text-white/20" />
              <p className="text-white/50 text-sm">No volunteers in this agency.</p>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">VOLUNTEER</th>
                    <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">SKILLS</th>
                    <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">AVAILABILITY</th>
                    <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">AGENCY ROLE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {volunteers.map((vol, idx) => {
                    const badge = getRoleBadge(vol.role ?? "MEMBER");
                    const isChanging = changingRole === vol.userId;
                    const isOwnUser = vol.userId === user?.id;
                    const open = openDropdown === vol.userId;
                    const flipUp = idx >= volunteers.length - 3 && volunteers.length > 3;

                    return (
                      <tr key={vol.userId} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {vol.profileImageUrl ? (
                              <img
                                src={vol.profileImageUrl}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
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
                                <span
                                  key={s.id}
                                  className="px-2 py-0.5 rounded bg-gray-700/60 text-white/60 text-[10px] font-medium"
                                >
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
                          {!isSuperadmin ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}>
                              <badge.icon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          ) : isChanging ? (
                            <div className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span className="text-white/50 text-xs">Updating...</span>
                            </div>
                          ) : (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setOpenDropdown(open ? null : vol.userId)}
                                disabled={isOwnUser}
                                title={isOwnUser ? "Cannot change your own role" : "Change role"}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${badge.bg} ${
                                  isOwnUser ? "opacity-50 cursor-not-allowed" : "hover:brightness-125 cursor-pointer"
                                }`}
                              >
                                <badge.icon className="w-3 h-3" />
                                {badge.label}
                                {!isOwnUser && <ChevronDown className="w-3 h-3 ml-0.5" />}
                              </button>
                              {open && (
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                              )}
                              {open && (
                                <div
                                  className="absolute right-0 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 py-1"
                                  style={{
                                    ...(flipUp
                                      ? { bottom: "100%", marginBottom: "4px" }
                                      : { top: "100%", marginTop: "4px" }),
                                  }}
                                >
                                  {ROLE_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => handleRoleChange(vol.userId, opt.value)}
                                      className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-gray-800 flex items-center gap-2"
                                    >
                                      <opt.icon className={`w-4 h-4 shrink-0 ${opt.color}`} />
                                      <span>{opt.label}</span>
                                    </button>
                                  ))}
                                </div>
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
        </>
      )}

      {!selectedAgencyId && !agenciesLoading && agencies.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Building2 className="w-10 h-10 text-white/15" />
          <p className="text-white/40 text-sm">Select an agency above to manage volunteer roles.</p>
        </div>
      )}
    </div>
  );
}

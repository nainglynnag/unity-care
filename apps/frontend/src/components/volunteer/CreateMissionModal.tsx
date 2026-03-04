import { useEffect, useState } from "react";
import { Loader2, X, Crown, User, Search } from "lucide-react";
import { createMission } from "@/lib/missions";
import {
  getMyAgencyMembership,
  getTeamMembers,
  type TeamMember,
} from "@/lib/agencyTeam";
import toast from "react-hot-toast";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
};

type SelectedVolunteer = { volunteerId: string; role: "LEADER" | "MEMBER"; name: string };

export function CreateMissionModal({
  incidentId,
  incidentTitle,
  onCreated,
  onClose,
}: {
  incidentId: string;
  incidentTitle: string;
  onCreated: (missionId: string) => void;
  onClose: () => void;
}) {
  const [missionType, setMissionType] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<TeamMember[]>([]);
  const [volLoading, setVolLoading] = useState(true);
  const [volSearch, setVolSearch] = useState("");
  const [selected, setSelected] = useState<SelectedVolunteer[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const membership = await getMyAgencyMembership();
        if (!membership) {
          toast.error("Could not resolve agency membership");
          return;
        }
        setAgencyId(membership.agencyId);
        const result = await getTeamMembers(membership.agencyId, { perPage: 50 });
        setVolunteers(result.members.filter((m) => m.isAvailable));
      } catch {
        toast.error("Failed to load volunteers");
      } finally {
        setVolLoading(false);
      }
    })();
  }, []);

  const toggleVolunteer = (vol: TeamMember) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.volunteerId === vol.userId);
      if (exists) return prev.filter((s) => s.volunteerId !== vol.userId);
      const role = prev.length === 0 ? "LEADER" : "MEMBER";
      return [...prev, { volunteerId: vol.userId, role, name: vol.name }];
    });
  };

  const setAsLeader = (volunteerId: string) => {
    setSelected((prev) =>
      prev.map((s) => ({
        ...s,
        role: s.volunteerId === volunteerId ? "LEADER" : "MEMBER",
      })),
    );
  };

  const hasLeader = selected.some((s) => s.role === "LEADER");
  const canSubmit = missionType.trim().length >= 2 && selected.length >= 1 && hasLeader && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createMission({
        primaryIncidentId: incidentId,
        missionType: missionType.trim(),
        priority,
        volunteers: selected.map((s) => ({ volunteerId: s.volunteerId, role: s.role })),
      });
      toast.success("Mission created and volunteers assigned");
      onCreated(result.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create mission");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVolunteers = volSearch.trim()
    ? volunteers.filter((v) => v.name.toLowerCase().includes(volSearch.toLowerCase()))
    : volunteers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4">
      <div className="w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg font-bold">Create Mission</h3>
          <button type="button" onClick={onClose} className="p-1 text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-800/80 rounded-lg px-3 py-2">
          <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase">Incident</p>
          <p className="text-white text-sm font-medium mt-0.5">{incidentTitle}</p>
        </div>

        {/* Mission type */}
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Mission type *</label>
          <input
            type="text"
            value={missionType}
            onChange={(e) => setMissionType(e.target.value)}
            placeholder="e.g. Search & Rescue, Medical Aid, Fire Response..."
            className="w-full mt-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-500 placeholder:text-white/30"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Priority *</label>
          <div className="flex gap-2 mt-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  priority === p ? PRIORITY_COLORS[p] : "bg-gray-800 text-white/40 border-gray-700 hover:text-white/60"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Volunteer selection */}
        <div>
          <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Assign volunteers * <span className="text-white/30 normal-case">(first selected = Leader)</span>
          </label>

          {/* Selected */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {selected.map((s) => (
                <div key={s.volunteerId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700">
                  {s.role === "LEADER" ? (
                    <Crown className="w-3 h-3 text-amber-400" />
                  ) : (
                    <button type="button" onClick={() => setAsLeader(s.volunteerId)} title="Set as leader">
                      <User className="w-3 h-3 text-white/40 hover:text-amber-400" />
                    </button>
                  )}
                  <span className="text-white text-xs font-medium">{s.name}</span>
                  <span className={`text-[9px] font-bold uppercase ${s.role === "LEADER" ? "text-amber-400" : "text-white/30"}`}>
                    {s.role}
                  </span>
                  <button type="button" onClick={() => toggleVolunteer({ userId: s.volunteerId } as TeamMember)} className="text-white/30 hover:text-red-400 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {volLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span className="text-white/50 text-xs">Loading available volunteers...</span>
            </div>
          ) : volunteers.length === 0 ? (
            <p className="text-white/40 text-xs mt-2">No available volunteers in your agency.</p>
          ) : (
            <>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={volSearch}
                  onChange={(e) => setVolSearch(e.target.value)}
                  placeholder="Search volunteers..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                {filteredVolunteers.map((vol) => {
                  const isSelected = selected.some((s) => s.volunteerId === vol.userId);
                  return (
                    <button
                      key={vol.userId}
                      type="button"
                      onClick={() => toggleVolunteer(vol)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-red-500/10 border border-red-500/30 text-white"
                          : "bg-gray-800/50 border border-transparent text-white/70 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      {vol.profileImageUrl ? (
                        <img src={vol.profileImageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                          <User className="w-3 h-3 text-white/40" />
                        </div>
                      )}
                      <span className="flex-1 font-medium">{vol.name}</span>
                      {vol.skills.length > 0 && (
                        <span className="text-white/30 text-[10px]">{vol.skills.map((s) => s.name).join(", ")}</span>
                      )}
                      {isSelected && <span className="text-red-400 text-[10px] font-bold">SELECTED</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create & assign mission
          </button>
        </div>
      </div>
    </div>
  );
}

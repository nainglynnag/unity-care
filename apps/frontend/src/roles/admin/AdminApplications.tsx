import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  X,
} from "lucide-react";
import {
  getApplications,
  startReview,
  reviewApplication,
  type AdminApplication,
} from "@/lib/admin";
import { getCurrentUser } from "@/lib/api";
import toast from "react-hot-toast";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-400",
  UNDER_REVIEW: "bg-blue-500/20 text-blue-400",
  APPROVED: "bg-emerald-500/20 text-emerald-400",
  REJECTED: "bg-red-500/20 text-red-400",
  WITHDRAWN: "bg-gray-600/30 text-gray-400",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminApplications() {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [reviewModal, setReviewModal] = useState<AdminApplication | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const userRole = getCurrentUser()?.role;
  const canReview = userRole === "SUPERADMIN" || userRole === "ADMIN";

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApplications({
        status: statusFilter || undefined,
        page,
        perPage: 15,
      });
      setApplications(result.applications);
      setTotalPages(result.totalPages);
      setTotalRecords(result.totalRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStartReview = async (app: AdminApplication) => {
    setActionLoading(true);
    try {
      await startReview(app.id);
      toast.success("Application claimed for review");
      await fetchApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (decision: "APPROVED" | "REJECTED", app?: AdminApplication) => {
    const target = app ?? reviewModal;
    if (!target) return;
    if (decision === "REJECTED" && reviewNote.length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    setActionLoading(true);
    try {
      await reviewApplication(
        target.id,
        decision,
        decision === "REJECTED" ? reviewNote : undefined,
      );
      toast.success(`Application ${decision.toLowerCase()}`);
      setReviewModal(null);
      setReviewNote("");
      await fetchApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">VOLUNTEER APPLICATIONS</h1>
        <p className="text-white/50 text-sm mt-1">{totalRecords} total applications</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "bg-blue-500/20 text-blue-400"
                : "bg-gray-800 text-white/60 hover:text-white hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && applications.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <FileCheck className="w-8 h-8 text-white/20" />
          <p className="text-white/50 text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <div
              key={app.id}
              className="p-4 rounded-xl bg-gray-800/80 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium text-sm">{app.applicant.name}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[app.status] ?? STATUS_STYLES.PENDING}`}>
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {app.applicant.email && (
                    <p className="text-white/50 text-xs">{app.applicant.email}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-white/40 text-xs">
                    <span>Agency: {app.agency.name}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(app.submittedAt)}
                    </span>
                    {app.reviewedBy && (
                      <span>Reviewed: {formatDate(app.reviewedAt ?? null)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canReview && app.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => handleStartReview(app)}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Review
                    </button>
                  )}
                  {canReview && app.status === "UNDER_REVIEW" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDecision("APPROVED", app)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewModal(app)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs font-medium">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-gray-800 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReviewModal(null)}>
          <div className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">Reject Application</h3>
              <button type="button" onClick={() => setReviewModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm">
              Rejecting application from <span className="text-white font-medium">{reviewModal.applicant.name}</span>
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Reason for rejection (min 5 characters)..."
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 min-h-[80px] focus:outline-none focus:border-red-500 placeholder:text-white/30"
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setReviewModal(null)} className="px-4 py-2 text-sm text-white/70 hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecision("REJECTED")}
                disabled={actionLoading || reviewNote.length < 5}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

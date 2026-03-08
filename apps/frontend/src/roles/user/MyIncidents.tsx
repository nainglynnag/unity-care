import { useState, useEffect } from "react";
import {
  getMyIncidents,
  closeIncident,
  resolveIncident,
  getIncident,
  type MyIncident,
  type IncidentDetail,
} from "../../lib/incidents";
import Header from "../../components/user/Header";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  X,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "REPORTED", label: "Reported" },
  { value: "AWAITING_VERIFICATION", label: "Awaiting Verification" },
  { value: "VERIFIED", label: "Verified" },
  { value: "CLOSED", label: "Closed" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

const PER_PAGE = 10;

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "REPORTED":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    case "AWAITING_VERIFICATION":
      return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "VERIFIED":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    case "CLOSED":
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
    case "RESOLVED":
      return "bg-purple-500/20 text-purple-400 border-purple-500/40";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyIncidents() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [incidents, setIncidents] = useState<MyIncident[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMode, setActionMode] = useState<"close" | "resolve" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyIncidents({
        status: statusFilter || undefined,
        page,
        perPage: PER_PAGE,
      });
      setIncidents(result.incidents);
      setTotalRecords(result.totalRecords);
      setTotalPages(result.totalPages);
      setCurrentPage(result.currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, page]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setActionMode(null);
    setActionNote("");
    try {
      const d = await getIncident(id);
      setDetail(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load incident");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedId(null);
    setDetail(null);
    setActionMode(null);
    setActionNote("");
  };

  const handleCloseIncident = async () => {
    if (!selectedId || !detail) return;
    if (actionNote.trim().length < 5) {
      toast.error("Note must be at least 5 characters");
      return;
    }
    setActionSubmitting(true);
    try {
      await closeIncident(selectedId, actionNote.trim());
      toast.success("Incident closed");
      closeModal();
      fetchIncidents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close incident");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleResolveIncident = async () => {
    if (!selectedId || !detail) return;
    if (actionNote.trim().length < 5) {
      toast.error("Note must be at least 5 characters");
      return;
    }
    setActionSubmitting(true);
    try {
      await resolveIncident(selectedId, actionNote.trim());
      toast.success("Incident resolved");
      closeModal();
      fetchIncidents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve incident");
    } finally {
      setActionSubmitting(false);
    }
  };

  const canCloseOrResolve =
    detail &&
    (detail.status === "REPORTED" || detail.status === "VERIFIED");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">My Incidents</h1>
          <p className="text-gray-400 mt-1">
            {totalRecords} incident{totalRecords !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-gray-800 text-white"
                  : "bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertTriangle className="flex-shrink-0 w-5 h-5" />
            <p>{error}</p>
            <button
              onClick={fetchIncidents}
              className="ml-auto px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Loading incidents...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && incidents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-14 h-14 mb-4 opacity-50" />
            <p className="text-lg">No incidents found</p>
            <p className="text-sm mt-1">
              {statusFilter
                ? "Try a different filter"
                : "You haven't reported any incidents yet"}
            </p>
          </div>
        )}

        {/* Incident cards */}
        {!loading && !error && incidents.length > 0 && (
          <>
            <div className="space-y-4">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => openDetail(inc.id)}
                  className="w-full text-left p-5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-900/80 transition-all focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {inc.title}
                      </h3>
                      <span
                        className={`inline-block mt-2 px-2.5 py-0.5 rounded text-xs font-medium border ${getStatusBadgeClasses(
                          inc.status
                        )}`}
                      >
                        {inc.status.replace(/_/g, " ")}
                      </span>
                      {inc.category && (
                        <p className="text-gray-400 text-sm mt-2">
                          {inc.category.name}
                        </p>
                      )}
                      {inc.addressText && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-gray-400 text-sm">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{inc.addressText}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-sm">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        {formatDate(inc.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
                <p className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-gray-900 border border-gray-800 shadow-xl">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
                <p className="mt-3 text-gray-400">Loading details...</p>
              </div>
            ) : detail ? (
              <>
                <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 z-10">
                  <h2 className="text-lg font-semibold text-white truncate pr-4">
                    {detail.title}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <span
                    className={`inline-block px-2.5 py-1 rounded text-sm font-medium border ${getStatusBadgeClasses(
                      detail.status
                    )}`}
                  >
                    {detail.status.replace(/_/g, " ")}
                  </span>
                  {detail.category && (
                    <p className="text-gray-400">
                      <span className="text-gray-500">Category:</span>{" "}
                      {detail.category.name}
                    </p>
                  )}
                  {detail.addressText && (
                    <div className="flex items-start gap-2 text-gray-400">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{detail.addressText}</span>
                    </div>
                  )}
                  {detail.description && (
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Description</p>
                      <p className="text-gray-300">{detail.description}</p>
                    </div>
                  )}
                  {detail.media && detail.media.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-sm mb-2">Media</p>
                      <div className="flex flex-wrap gap-2">
                        {detail.media.map((m) =>
                          m.mediaType === "IMAGE" ? (
                            <img
                              key={m.id}
                              src={m.url}
                              alt=""
                              className="w-20 h-20 object-cover rounded-lg border border-gray-700"
                            />
                          ) : (
                            <a
                              key={m.id}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:underline"
                            >
                              {m.mediaType} attachment
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action: Close or Resolve with note */}
                  {canCloseOrResolve && (
                    <div className="pt-4 border-t border-gray-800">
                      {!actionMode ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setActionMode("close")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Close Incident
                          </button>
                          <button
                            onClick={() => setActionMode("resolve")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Resolve Incident
                          </button>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            {actionMode === "close"
                              ? "Reason for closing (min 5 characters)"
                              : "Resolution note (min 5 characters)"}
                          </label>
                          <textarea
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder="Enter your note..."
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600 resize-none"
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => {
                                setActionMode(null);
                                setActionNote("");
                              }}
                              disabled={actionSubmitting}
                              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={
                                actionMode === "close"
                                  ? handleCloseIncident
                                  : handleResolveIncident
                              }
                              disabled={
                                actionSubmitting ||
                                actionNote.trim().length < 5
                              }
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                                actionMode === "close"
                                  ? "bg-amber-600 hover:bg-amber-500"
                                  : "bg-emerald-600 hover:bg-emerald-500"
                              }`}
                            >
                              {actionSubmitting && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              )}
                              {actionMode === "close" ? "Close" : "Resolve"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

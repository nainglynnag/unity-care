import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import { API_BASE, authFetch } from "../lib/api";
import { createIncident, getIncidentCategories, type IncidentCategory } from "../lib/incidents";

const HELP_TITLES: Record<string, string> = {
  text: "Emergency - Text support",
  voice: "Emergency - Voice call",
  video: "Emergency - Video call",
};

const TITLE_MIN_LENGTH = 3;

function ChooseHelp() {
  const [step, setStep] = useState<"form" | "options">("form");
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [silentMode, setSilentMode] = useState(false);
  const [location, setLocation] = useState<{
    lat: number | null;
    lng: number | null;
    addressText: string | null;
    loading: boolean;
    error: string | null;
  }>({ lat: null, lng: null, addressText: null, loading: true, error: null });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const handleFormContinue = () => {
    const trimmed = incidentTitle.trim();
    setFormError(null);
    if (trimmed.length < TITLE_MIN_LENGTH) {
      setFormError(`Title must be at least ${TITLE_MIN_LENGTH} characters.`);
      return;
    }
    setIncidentTitle(trimmed);
    setIncidentDescription(incidentDescription.trim());
    setStep("options");
  };

  const handleOptionClick = async (option: string) => {
    if (option === "voice" && silentMode) return;
    if (location.loading) return;
    if (location.error || !location.lat || !location.lng) {
      setSubmitError("Location is required. Please enable location and try again.");
      return;
    }
    const title = incidentTitle.trim().length >= TITLE_MIN_LENGTH
      ? incidentTitle.trim()
      : (HELP_TITLES[option] ?? "Emergency - Need help");
    setSubmitError(null);
    setSubmitting(true);
    try {
      const data = await createIncident({
        title,
        latitude: location.lat,
        longitude: location.lng,
        forSelf: true,
        description: incidentDescription.trim() || undefined,
        addressText: location.addressText ?? undefined,
        accuracy: "GPS",
        ...(categoryId.trim() && { categoryId: categoryId.trim() }),
      });
      const incidentId = data?.incident?.id;
      const state = { incidentId };
      if (option === "text") {
        navigate("/chat", { state });
      } else if (option === "voice") {
        navigate("/voicecall", { state });
      } else if (option === "video") {
        navigate("/videocall", { state: { ...state, silentMode } });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle microphone mute/unmute based on silent mode
  useEffect(() => {
    const controlMicrophone = async () => {
      try {
        if (silentMode) {
          // Request microphone access and mute it
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            // Mute all audio tracks
            stream.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
          }
        } else {
          // Unmute microphone if stream exists
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = true;
            });
          }
        }
      } catch (error) {
        console.error("Error controlling microphone:", error);
        // Silently fail - microphone permission might not be granted yet
      }
    };

    controlMicrophone();

    // Cleanup: stop tracks when component unmounts
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }
    };
  }, [silentMode]);

  useEffect(() => {
    let cancelled = false;

    const ensureAuthenticatedSession = async () => {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (!res.ok && !cancelled) {
        navigate("/login", { replace: true });
      }
    };

    ensureAuthenticatedSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Fetch incident categories for the form
  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    getIncidentCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Get location on mount so it's ready when user picks an option
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation is not supported.",
      }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let addressText: string | null = null;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          addressText = data.display_name ?? null;
        } catch {
          addressText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        }
        setLocation({
          lat: latitude,
          lng: longitude,
          addressText,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: err.message || "Unable to get location.",
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const canStart = !location.loading && location.lat != null && location.lng != null && !location.error;
  const buttonsDisabled = submitting || !canStart;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl flex flex-col items-center gap-10">
          {step === "form" ? (
            <>
              <h1 className="text-white text-4xl md:text-5xl font-bold text-center">
                Report your emergency
              </h1>
              <div className="w-full flex flex-col gap-4">
                <h2 className="text-gray-400 text-sm font-semibold uppercase tracking-wide">
                  Incident details
                </h2>
                <label className="text-gray-300 font-medium">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="e.g. Medical emergency, Accident, Fire"
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  minLength={TITLE_MIN_LENGTH}
                  maxLength={120}
                />
                <label className="text-gray-500 text-sm">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-gray-800/80 border border-gray-700/50 text-gray-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 cursor-pointer appearance-none bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378819c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
                >
                  <option value="">Select…</option>
                  {categoriesLoading ? (
                    <option value="" disabled>Loading…</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  )}
                </select>
                <label className="text-gray-300 font-medium">Description (optional)</label>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Add details about the situation, number of people, injuries, etc."
                  rows={4}
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                {formError && (
                  <p className="text-red-400 text-sm">{formError}</p>
                )}
                <button
                  type="button"
                  onClick={handleFormContinue}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 rounded-xl transition-colors mt-2"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Main Title */}
              <h1 className="text-white text-4xl md:text-5xl font-bold text-center">
                How do you need help?
              </h1>

              {location.loading && (
                <p className="text-gray-400 text-sm">Getting your location...</p>
              )}
              {location.error && (
                <p className="text-amber-500 text-sm">{location.error}</p>
              )}
              {submitError && (
                <p className="text-red-400 text-sm">{submitError}</p>
              )}
              {/* Communication Options */}
          <div className="w-full flex flex-col gap-5">
            {/* Text Option */}
            <button
              type="button"
              onClick={() => handleOptionClick("text")}
              disabled={buttonsDisabled}
              className={`w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 transition-colors duration-200 ${
                buttonsDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-700 cursor-pointer"
              }`}
            >
              {/* Blue Speech Bubble Icon */}
              <div className="flex-shrink-0 text-blue-500">
                <ChatBubbleOutlineIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="text-white font-medium text-lg">Text</div>
                <div className="text-gray-400 text-base">Chat with emergency coordinator</div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className="text-gray-400 flex-shrink-0" sx={{ fontSize: 24 }} />
            </button>

            {/* Voice Call Option */}
            <button
              type="button"
              onClick={() => handleOptionClick("voice")}
              disabled={silentMode || buttonsDisabled}
              className={`w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 transition-colors duration-200 relative ${
                silentMode || buttonsDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-700 cursor-pointer"
              }`}
            >
              {/* Red Phone Icon */}
              <div className={`flex-shrink-0 ${silentMode ? "text-gray-600" : "text-red-500"}`}>
                <PhoneIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <div className={`font-medium text-lg ${silentMode ? "text-gray-500" : "text-white"}`}>
                    Voice Call
                  </div>
                  {/* Recommended Badge */}
                  {!silentMode && (
                    <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-1 rounded">
                      Recommended
                    </span>
                  )}
                  {silentMode && (
                    <span className="bg-gray-700 text-gray-400 text-sm font-medium px-2.5 py-1 rounded">
                      Disabled
                    </span>
                  )}
                </div>
                <div className={`text-base ${silentMode ? "text-gray-600" : "text-gray-400"}`}>
                  {silentMode ? "Turn off silent mode to use voice call" : "Speak directly with responder"}
                </div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className={`flex-shrink-0 ${silentMode ? "text-gray-600" : "text-gray-400"}`} sx={{ fontSize: 24 }} />
            </button>

            {/* Video Call Option */}
            <button
              type="button"
              onClick={() => handleOptionClick("video")}
              disabled={buttonsDisabled}
              className={`w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 transition-colors duration-200 ${
                buttonsDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-700 cursor-pointer"
              }`}
            >
              {/* Purple Video Camera Icon */}
              <div className="flex-shrink-0 text-purple-500">
                <VideocamIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="text-white font-medium text-lg">Video Call</div>
                <div className="text-gray-400 text-base">Visual communication for clarity</div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className="text-gray-400 flex-shrink-0" sx={{ fontSize: 24 }} />
            </button>
          </div>

              {/* Silent Mode Toggle */}
              <div className="w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5">
                <div className="flex-shrink-0 text-gray-400">
                  <VolumeOffIcon sx={{ fontSize: 32 }} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium text-lg">Silent Mode</div>
                  <div className="text-gray-400 text-base">No sounds or vibrations</div>
                </div>
                <button
                  onClick={() => setSilentMode(!silentMode)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ${
                    silentMode ? "bg-red-500" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-200 ${
                      silentMode ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default ChooseHelp;
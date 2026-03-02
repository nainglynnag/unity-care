import { useState, useRef, useEffect } from "react";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import PhoneIcon from "@mui/icons-material/Phone";
import { useNavigate, useLocation } from "react-router-dom";
import { getIncident, type IncidentDetail } from "../lib/incidents";

type ChatAttachment = {
  type: "image" | "video" | "file";
  url: string;
  name: string;
};

type Message = {
  id: string;
  text: string;
  sender: "unity" | "user";
  time: string;
  attachments?: ChatAttachment[];
};

type LocationState = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  cityRegion: string | null;
  loading: boolean;
  error: string | null;
};

function Chat() {
  const locationState = useLocation().state as {
    incidentId?: string;
    primaryContact?: { name: string; phone: string };
  } | null;
  const incidentId = locationState?.incidentId;
  const primaryContact = locationState?.primaryContact;
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [timerStartedAt] = useState(() => new Date());
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    address: null,
    cityRegion: null,
    loading: true,
    error: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const getAttachmentType = (file: File): "image" | "video" | "file" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return "file";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = getAttachmentType(file);
      newAttachments.push({
        type,
        url: URL.createObjectURL(file),
        name: file.name,
      });
    }
    setPendingAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
    e.target.value = "";
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].url);
      return next;
    });
  };

  const pendingAttachmentsRef = useRef<ChatAttachment[]>([]);
  pendingAttachmentsRef.current = pendingAttachments;
  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get real user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        loading: false,
        error: "Geolocation is not supported by your browser.",
      }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation((prev) => ({ ...prev, lat: latitude, lng: longitude, loading: false, error: null }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address;
          const road = addr?.road || addr?.street || "";
          const house = addr?.house_number || "";
          const address = [house, road].filter(Boolean).join(" ") || data.display_name?.split(",")[0] || null;
          const city = addr?.city || addr?.town || addr?.village || addr?.municipality || "";
          const state = addr?.state || addr?.county || "";
          const cityRegion = [city, state].filter(Boolean).join(", ") || null;
          setLocation((prev) => ({
            ...prev,
            address: address || prev.address,
            cityRegion: cityRegion || prev.cityRegion,
          }));
        } catch {
          setLocation((prev) => ({
            ...prev,
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            cityRegion: "Coordinates",
          }));
        }
      },
      (err) => {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: err.message || "Unable to get your location.",
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Fetch incident when incidentId is in state (from ChooseHelp)
  useEffect(() => {
    if (!incidentId) return;
    let cancelled = false;
    getIncident(incidentId).then((data) => {
      if (!cancelled) setIncident(data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  // Incident timer: count elapsed seconds from when chat was opened
  useEffect(() => {
    const tick = () => {
      setTimerSeconds(Math.floor((Date.now() - timerStartedAt.getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!trimmed && !hasAttachments) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        text: trimmed || "(attachment)",
        sender: "user",
        time: timeStr,
        attachments: hasAttachments ? [...pendingAttachments] : undefined,
      },
    ]);
    setInput("");
    setPendingAttachments([]);
  };

  const volunteerName =
    incident?.missions?.[0]?.assignments?.[0]?.assignee?.name ?? null;

  const chatState = () => (incidentId ? { incidentId, primaryContact } : undefined);
  const handleVoiceCall = () => {
    navigate("/voicecall", { state: chatState() });
  };
  const handleCallContact = () => {
    const phone = primaryContact?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      handleVoiceCall();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex min-h-0 relative">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Toggle sidebar"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="text-white text-xl font-bold">Unity Care</span>
              <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Online
              </span>
            </div>
            {sidebarOpen ? (
              <button
                type="button"
                aria-label="Menu"
              >
                
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer "
                aria-label="Open sidebar"
              >
                <ChevronLeftIcon />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.sender === "unity"
                      ? "bg-gray-700/80 text-white"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att, i) => (
                        <div key={i} className="rounded-lg overflow-hidden bg-gray-900/50">
                          {att.type === "image" && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={att.url} alt={att.name} className="max-h-40 max-w-full object-contain" />
                            </a>
                          )}
                          {att.type === "video" && (
                            <video src={att.url} controls className="max-h-40 max-w-full" title={att.name} />
                          )}
                          {att.type === "file" && (
                            <a
                              href={att.url}
                              download={att.name}
                              className="flex items-center gap-2 px-3 py-2 text-blue-400 hover:text-blue-300 text-sm"
                            >
                              <AttachFileIcon fontSize="small" /> {att.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className="text-gray-400 text-xs mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-gray-800 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,*/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                    {att.type === "image" && (
                      <img src={att.url} alt={att.name} className="h-16 w-16 object-cover" />
                    )}
                    {att.type === "video" && (
                      <video src={att.url} className="h-16 w-20 object-cover" />
                    )}
                    {att.type === "file" && (
                      <div className="h-16 px-3 flex items-center gap-2 min-w-[120px]">
                        <AttachFileIcon className="text-gray-400" fontSize="small" />
                        <span className="text-white text-xs truncate">{att.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(i)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Remove"
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Attach image, video, or file"
              >
                <AttachFileIcon fontSize="small" />
              </button>
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-white placeholder-gray-500 py-2 outline-none text-sm"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() && pendingAttachments.length === 0}
                className="p-2 text-blue-500 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Send"
              >
                <SendIcon fontSize="small" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Incident Status Sidebar - Sticky */}
        {sidebarOpen && (
          <div className="w-[360px] shrink-0 border-l border-gray-800 bg-gray-900/50 sticky top-0 h-screen overflow-y-auto transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-lg font-semibold">Incident Status</h2>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-white font-bold text-lg hover:bg-gray-700 transition-colors cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <ChevronRightIcon fontSize="small" />
                </button>
              </div>


          {/* Incident details (title, category, description) */}
          {incident && (
            <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-lg">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Description</h3>
              <p className="text-white font-medium mb-1">{incident.title}</p>
              <p className="text-gray-400 text-sm mb-2">
                Category: <span className="text-white">{incident.category.name}</span>
              </p>
              {incident.description && (
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{incident.description}</p>
              )}
            </div>
          )}

          {/* Incident Timer */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Incident Timer</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-3xl font-bold tabular-nums">
                {formatTimer(timerSeconds)}
              </span>
              <span className="text-green-500 text-sm font-medium">ACTIVE</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Started at {timerStartedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            </p>
          </div>

          {/* Location */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Location</h3>
            <div className="flex items-start gap-2">
              <LocationOnIcon className="text-red-500 shrink-0 mt-0.5" fontSize="small" />
              <div className="text-white text-sm min-w-0">
                {location.loading && (
                  <p className="text-gray-400">Getting your location...</p>
                )}
                {location.error && (
                  <p className="text-amber-400">{location.error}</p>
                )}
                {!location.loading && !location.error && (
                  <>
                    <p>{location.address ?? (location.lat != null && location.lng != null ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "—")}</p>
                    <p className="text-gray-400">{location.cityRegion ?? "Current position"}</p>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/map", {
                state: location.lat != null && location.lng != null
                  ? { lat: location.lat, lng: location.lng, incidentId, primaryContact }
                  : incidentId ? { incidentId, primaryContact } : undefined,
              })}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <LocationOnIcon fontSize="small" />
              Map
            </button>
          </div>

          {/* Response Team / Contact volunteer */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Contact volunteer</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold text-lg shrink-0 overflow-hidden">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="7"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">
                  {volunteerName ?? "Emergency coordinator"}
                </p>
                <p className="text-gray-400 text-sm">
                  {volunteerName ? "Assigned volunteer" : "You can chat, call, or video call"}
                </p>
              </div>
            </div>
            {primaryContact && (
              <div className="mb-4 pt-3 border-t border-gray-700">
                <p className="text-gray-400 text-xs font-medium mb-1">Emergency contact</p>
                <p className="text-white font-medium">{primaryContact.name}</p>
                <a
                  href={`tel:${primaryContact.phone}`}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {primaryContact.phone}
                </a>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCallContact}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PhoneIcon sx={{ fontSize: 20 }} />
                {primaryContact?.phone ? `Call ${primaryContact.name}` : "Voice call"}
              </button>
            </div>
          </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;

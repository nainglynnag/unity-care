import { useState, useRef, useEffect } from "react";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import SendIcon from "@mui/icons-material/Send";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";

type Message = {
  id: string;
  text: string;
  sender: "unity" | "user";
  time: string;
};

const initialMessages: Message[] = [
  {
    id: "1",
    text: "Hello, this is Unity Care Emergency Response. I've received your alert. Are you safe right now?",
    sender: "unity",
    time: "10:42 AM",
  },
  {
    id: "2",
    text: "Yes, I'm safe but need assistance",
    sender: "user",
    time: "10:43 AM",
  },
  {
    id: "3",
    text: "Good to hear. Can you describe your situation? What kind of help do you need?",
    sender: "unity",
    time: "10:43 AM",
  },
  {
    id: "4",
    text: "Medical emergency - chest pain",
    sender: "user",
    time: "10:44 AM",
  },
  {
    id: "5",
    text: "I've dispatched a volunteer unit to your location. ETA is 3 minutes. Stay calm and remain where you are.",
    sender: "unity",
    time: "10:44 AM",
  },
];

type LocationState = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  cityRegion: string | null;
  loading: boolean;
  error: string | null;
};

function Chat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(2 * 60 + 15); // 02:15
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
  const navigate = useNavigate();



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

  // Incident timer count-up
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
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
        text: trimmed,
        sender: "user",
        time: timeStr,
      },
    ]);
    setInput("");
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
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className="text-gray-400 text-xs mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-gray-800 shrink-0">
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Attach"
              >
                <CameraAltOutlinedIcon fontSize="small" />
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
                className="p-2 text-blue-500 hover:text-blue-400 transition-colors"
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

          {/* Incident Timer */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Incident Timer</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-3xl font-bold tabular-nums">
                {formatTimer(timerSeconds)}
              </span>
              <span className="text-green-500 text-sm font-medium">ACTIVE</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Started at 10:42 AM</p>
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
              onClick={() => navigate("/map", { state: location.lat != null && location.lng != null ? { lat: location.lat, lng: location.lng } : undefined })}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <LocationOnIcon fontSize="small" />
              Map
            </button>
          </div>

          {/* Response Team */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Response Team</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full  flex items-center justify-center text-white font-semibold text-lg shrink-0 overflow-hidden">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white-500"
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
                <p className="text-white font-medium">Sarah Martinez</p>
                <p className="text-gray-400 text-sm">Emergency Coordinator</p>
              </div>
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

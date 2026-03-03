import { useState, useEffect } from "react";
import {
  Flame,
  Stethoscope,
  Clock,
  ClipboardCheck,
  Award,
  X,
} from "lucide-react";
import { VolunteerMapCard } from "@/components/volunteer/VolunteerMapCard";

const MOCK_INCIDENTS = [
  {
    id: "1",
    type: "fire",
    title: "Fire Alarm - Sector 4",
    description:
      "Reported 4 minutes ago near Industrial Park West. Smoke reported by multiple sources.",
    distance: "0.5km away",
    icon: Flame,
    iconColor: "text-red-500",
  },
  {
    id: "2",
    type: "medical",
    title: "Medical Assistance - North Plaza",
    description:
      "Minor injury reported at the public transport hub. Victim is stable but requires basic first aid.",
    distance: "1.2km away",
    icon: Stethoscope,
    iconColor: "text-blue-400",
  },
];

export default function VolunteerDashboard() {
  const [elapsed, setElapsed] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionActive) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [sessionActive]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported.");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
        setLocationLoading(false);
      },
      () => {
        setLocationError("Unable to get your location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top row: Mission time + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Mission Time */}
        <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <h2 className="text-white/70 text-xs font-semibold tracking-wider mb-3 text-shadow-down">
            ACTIVE MISSION TIME
          </h2>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-white">
              {formatTime(elapsed)}
            </span>
            <span className="text-white/60 text-sm">ELAPSED</span>
          </div>
          <button
            type="button"
            onClick={() => setSessionActive(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            TERMINATE SESSION
          </button>
        </div>

        <VolunteerMapCard
          userLocation={userLocation}
          locationLoading={locationLoading}
          locationError={locationError}
          onSetLocation={(lat, lng) => setUserLocation([lat, lng])}
        />
      </div>

      {/* Bottom row: Nearby incidents + Mission stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nearby Incidents */}
        <div className="lg:col-span-2 bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-shadow-down">NEARBY INCIDENTS</h2>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-xs font-semibold">
                4 ACTIVE
              </span>
            </div>
            <button
              type="button"
              className="text-red-500 hover:text-red-400 text-sm font-medium"
            >
              VIEW ALL →
            </button>
          </div>
          <ul className="space-y-4">
            {MOCK_INCIDENTS.map((inc) => (
              <li
                key={inc.id}
                className="p-4 rounded-lg bg-gray-900/80 border border-gray-800"
              >
                <div className="flex gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 ${inc.iconColor}`}
                  >
                    <inc.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{inc.title}</p>
                    <p className="text-white/60 text-xs mt-1">{inc.description}</p>
                    <p className="text-white/50 text-xs mt-2">{inc.distance}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        CONFIRM INCIDENT
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 border border-red-500/60 text-red-500 hover:bg-red-500/10 text-xs font-semibold rounded-lg transition-colors"
                      >
                        DENY / FALSE ALARM
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Mission Stats */}
        <div className="bg-gray-800/80 border border-gray-800 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <h2 className="text-red-500 text-sm font-semibold tracking-wider mb-4 text-shadow-down">
            MISSION STATS
          </h2>
          <ul className="space-y-4">
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <ClipboardCheck className="w-4 h-4 text-white/60" />
                <span>MISSIONS DONE</span>
              </div>
              <span className="text-white font-bold">0</span>
            </li>
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Clock className="w-4 h-4 text-white/60" />
                <span>TOTAL HOURS</span>
              </div>
              <span className="text-white font-bold">0</span>
            </li>
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Award className="w-4 h-4 text-white/60" />
                <span>CURRENT RANK</span>
              </div>
              <span className="text-white/60 text-sm">NO RANK</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

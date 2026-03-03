import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import StarIcon from "@mui/icons-material/Star";

function CompleteMission() {
  const navigate = useNavigate();
  const locationState = useLocation().state as {
    volunteerName?: string;
    volunteerRole?: string;
    volunteerRating?: number;
  } | null;

  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  const volunteerName = locationState?.volunteerName ?? "Sarah Martinez";
  const volunteerRole = locationState?.volunteerRole ?? "Certified First Responder";
  const volunteerRating = locationState?.volunteerRating ?? 4.8;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-500"
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
          </div>
          <span className="text-white text-xl font-bold">Unity Care</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-6">
          <CheckIcon className="text-white" sx={{ fontSize: 48 }} />
        </div>
        <h1 className="text-white text-2xl font-bold mb-2">Mission Completed</h1>
        <p className="text-gray-400 text-sm mb-10 text-center max-w-sm">
          The emergency has been successfully resolved.
        </p>

        {/* Volunteer Profile */}
        <div className="w-full max-w-xs mb-8">
          <div className="border border-red-500/60 rounded-xl p-6 flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-3 border-2 border-red-500/30">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            {/* Name */}
            <h3 className="text-white font-semibold text-lg mb-1">{volunteerName}</h3>
            
            {/* Role */}
            <p className="text-gray-400 text-sm mb-3">{volunteerRole}</p>
            
            {/* Rating */}
            <div className="flex items-center gap-1.5">
              <StarIcon className="text-amber-400" sx={{ fontSize: 18 }} />
              <span className="text-gray-300 text-sm font-medium">{volunteerRating}</span>
              <span className="text-gray-500 text-xs">(50+ responses)</span>
            </div>
          </div>
        </div>

        {/* Star Rating */}
        <div className="mb-8 flex flex-col items-center">
          <p className="text-gray-400 text-sm mb-3">Rate your volunteer</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
              >
                <StarIcon
                  className={`transition-colors ${
                    star <= (hoveredRating || rating)
                      ? "text-amber-400"
                      : "text-gray-600"
                  }`}
                  sx={{ fontSize: 32 }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Back to Home Button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full max-w-xs py-3 px-6 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
        >
          Back to Home
        </button>
      </main>
    </div>
  );
}

export default CompleteMission;

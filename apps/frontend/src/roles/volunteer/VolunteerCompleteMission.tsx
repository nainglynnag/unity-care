import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

export default function VolunteerCompleteMission() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-950 min-h-full">
      <div className="w-full max-w-sm flex flex-col items-center text-center mx-auto">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-white text-2xl font-bold mb-2">Mission completed</h1>
        <p className="text-gray-400 text-sm mb-8 max-w-xs">
          Your completion report has been submitted. Thank you for your response.
        </p>
        <button
          type="button"
          onClick={() => navigate("/volunteer-dashboard", { replace: true })}
          className="w-full py-3 px-6 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

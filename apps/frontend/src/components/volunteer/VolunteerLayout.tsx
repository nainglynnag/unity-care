import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { VolunteerSidebar } from "./VolunteerSidebar";
import { VolunteerHeader } from "./VolunteerHeader";
import { getAccessToken, getCurrentUser } from "../../lib/api";

export function VolunteerLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    // If logged in but not a volunteer (no volunteer profile in DB), redirect to user flow
    if (getAccessToken() && !getCurrentUser()?.hasVolunteerProfile) {
      navigate("/choosehelp", { replace: true });
    }
  }, [navigate]);

  // Don't render volunteer UI for logged-in non-volunteers (redirect in progress)
  if (getAccessToken() && !getCurrentUser()?.hasVolunteerProfile) {
    return null;
  }

  const isSignedIn = !!getAccessToken();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex flex-1 min-w-0">
        <VolunteerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {!isSignedIn && <VolunteerHeader />}
          <main className="flex-1 overflow-auto relative">
            <div className="absolute inset-0 bg-gradient-radial from-gray-900 via-gray-950 to-gray-950 pointer-events-none" aria-hidden />
            <div className="relative z-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

import { Route, Navigate } from "react-router-dom";
import Signin from "../roles/user/signin";
import { ProtectedRoute } from "../components/shared/ProtectedRoute";
import { VolunteerLayout } from "../components/volunteer/VolunteerLayout";
import VolunteerDashboard from "../roles/volunteer/VolunteerDashboard";
import VolunteerApplication from "../roles/volunteer/VolunteerApplication";
import VolunteerProfile from "../roles/volunteer/VolunteerProfile";
import VolunteerMissions from "../roles/volunteer/VolunteerMissions";
import VolunteerMissionHistory from "../roles/volunteer/VolunteerMissionHistory";
import VolunteerValidation from "../roles/volunteer/VolunteerValidation";
import VolunteerTeam from "../roles/volunteer/VolunteerTeam";
import VolunteerAnalytics from "../roles/volunteer/VolunteerAnalytics";

export const VolunteerRouteElements = (
  <>
    <Route path="/volunteer" element={<Navigate to="/volunteer-dashboard" replace />} />
    <Route path="/volunteer-signin" element={<Signin />} />
    <Route path="/volunteer-apply" element={<VolunteerApplication />} />
    <Route element={<ProtectedRoute allowedRoles={["VOLUNTEER"]} redirectTo="/volunteer-signin" />}>
      <Route path="/volunteer-dashboard" element={<VolunteerLayout />}>
        <Route index element={<VolunteerDashboard />} />
        <Route path="missions" element={<VolunteerMissions />} />
        <Route path="mission-history" element={<VolunteerMissionHistory />} />
        <Route path="validation" element={<VolunteerValidation />} />
        <Route path="team" element={<VolunteerTeam />} />
        <Route path="analytics" element={<VolunteerAnalytics />} />
        <Route path="profile" element={<VolunteerProfile />} />
      </Route>
    </Route>
  </>
);
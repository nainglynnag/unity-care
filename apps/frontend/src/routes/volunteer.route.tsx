import { Route, Navigate } from "react-router-dom";
import Signin from "../roles/user/signin";
import { VolunteerLayout } from "../components/volunteer/VolunteerLayout";
import VolunteerDashboard from "../roles/volunteer/VolunteerDashboard";
import VolunteerApplication from "../roles/volunteer/VolunteerApplication";
import VolunteerProfile from "../roles/volunteer/VolunteerProfile";

export const VolunteerRouteElements = (
  <>
    <Route path="/volunteer" element={<Navigate to="/volunteer-dashboard" replace />} />
    <Route path="/volunteer-signin" element={<Signin />} />
    <Route path="/volunteer-apply" element={<VolunteerApplication />} />
    <Route path="/volunteer-dashboard" element={<VolunteerLayout />}>
      <Route index element={<VolunteerDashboard />} />
      <Route path="profile" element={<VolunteerProfile />} />
    </Route>
  </>
);
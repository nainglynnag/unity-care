import { lazy, Suspense } from "react";
import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../components/shared/ProtectedRoute";
import { VolunteerLayout } from "../components/volunteer/VolunteerLayout";

const Signin = lazy(() => import("../roles/user/signin"));
const VolunteerApplication = lazy(() => import("../roles/volunteer/VolunteerApplication"));
const VolunteerDashboard = lazy(() => import("../roles/volunteer/VolunteerDashboard"));
const VolunteerProfile = lazy(() => import("../roles/volunteer/VolunteerProfile"));
const VolunteerMissions = lazy(() => import("../roles/volunteer/VolunteerMissions"));
const VolunteerMissionHistory = lazy(() => import("../roles/volunteer/VolunteerMissionHistory"));
const VolunteerValidation = lazy(() => import("../roles/volunteer/VolunteerValidation"));
const VolunteerTeam = lazy(() => import("../roles/volunteer/VolunteerTeam"));
const VolunteerAnalytics = lazy(() => import("../roles/volunteer/VolunteerAnalytics"));
const VolunteerCompleteMission = lazy(() => import("../roles/volunteer/VolunteerCompleteMission"));

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export const VolunteerRouteElements = (
  <>
    <Route path="/volunteer" element={<Navigate to="/volunteer-dashboard" replace />} />
    <Route path="/volunteer-signin" element={<LazyWrap><Signin /></LazyWrap>} />
    <Route path="/volunteer-apply" element={<LazyWrap><VolunteerApplication /></LazyWrap>} />
    <Route element={<ProtectedRoute allowedRoles={["VOLUNTEER"]} redirectTo="/volunteer-signin" />}>
      <Route path="/volunteer-dashboard" element={<VolunteerLayout />}>
        <Route index element={<LazyWrap><VolunteerDashboard /></LazyWrap>} />
        <Route path="missions" element={<LazyWrap><VolunteerMissions /></LazyWrap>} />
        <Route path="mission-history" element={<LazyWrap><VolunteerMissionHistory /></LazyWrap>} />
        <Route path="validation" element={<LazyWrap><VolunteerValidation /></LazyWrap>} />
        <Route path="team" element={<LazyWrap><VolunteerTeam /></LazyWrap>} />
        <Route path="analytics" element={<LazyWrap><VolunteerAnalytics /></LazyWrap>} />
        <Route path="profile" element={<LazyWrap><VolunteerProfile /></LazyWrap>} />
        <Route path="complete-mission" element={<LazyWrap><VolunteerCompleteMission /></LazyWrap>} />
      </Route>
    </Route>
  </>
);

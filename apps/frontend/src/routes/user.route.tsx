import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute, RedirectVolunteerFromUserPage } from "../components/shared/ProtectedRoute";

const SOSpage = lazy(() => import("../roles/user/SOSpage"));
const Signin = lazy(() => import("../roles/user/signin"));
const SignUp = lazy(() => import("../roles/user/signup"));
const EmergencyProfileSetup = lazy(() => import("../roles/user/EmergencyProfileSetup"));
const ChooseHelp = lazy(() => import("../roles/user/ChooseHelp"));
const Chat = lazy(() => import("../roles/user/Chat"));
const Map = lazy(() => import("../roles/user/Map"));
const CompleteMission = lazy(() => import("../roles/user/CompleteMission"));
const VoiceCall = lazy(() => import("../roles/user/VoiceCall"));
const VideoCall = lazy(() => import("../roles/user/VideoCall"));
const MyIncidents = lazy(() => import("../roles/user/MyIncidents"));
const EmergencyProfileView = lazy(() => import("../roles/user/EmergencyProfileView"));
const AccountSettings = lazy(() => import("../roles/user/AccountSettings"));

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export const UserRouteElements = (
  <>
    <Route path="/" element={<RedirectVolunteerFromUserPage><LazyWrap><SOSpage /></LazyWrap></RedirectVolunteerFromUserPage>} />
    <Route path="/signin" element={<RedirectVolunteerFromUserPage><LazyWrap><Signin /></LazyWrap></RedirectVolunteerFromUserPage>} />
    <Route path="/signup" element={<RedirectVolunteerFromUserPage><LazyWrap><SignUp /></LazyWrap></RedirectVolunteerFromUserPage>} />

    <Route element={<ProtectedRoute allowedRoles={["CIVILIAN"]} redirectTo="/signin" />}>
      <Route path="/setup-profile" element={<LazyWrap><EmergencyProfileSetup /></LazyWrap>} />
      <Route path="/choosehelp" element={<RedirectVolunteerFromUserPage><LazyWrap><ChooseHelp /></LazyWrap></RedirectVolunteerFromUserPage>} />
      <Route path="/chat" element={<LazyWrap><Chat /></LazyWrap>} />
      <Route path="/map" element={<LazyWrap><Map /></LazyWrap>} />
      <Route path="/completemission" element={<LazyWrap><CompleteMission /></LazyWrap>} />
      <Route path="/voicecall" element={<LazyWrap><VoiceCall /></LazyWrap>} />
      <Route path="/videocall" element={<LazyWrap><VideoCall /></LazyWrap>} />
      <Route path="/my-incidents" element={<LazyWrap><MyIncidents /></LazyWrap>} />
      <Route path="/emergency-profile" element={<LazyWrap><EmergencyProfileView /></LazyWrap>} />
      <Route path="/account-settings" element={<LazyWrap><AccountSettings /></LazyWrap>} />
    </Route>
  </>
);

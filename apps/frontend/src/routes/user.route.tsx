import { Route } from "react-router-dom";
import SOSpage from "../roles/user/SOSpage";
import Signin from "../roles/user/signin";
import SignUp from "../roles/user/signup";
import EmergencyProfileSetup from "../roles/user/EmergencyProfileSetup";
import ChooseHelp from "../roles/user/ChooseHelp";
import Chat from "../roles/user/Chat";
import Map from "../roles/user/Map";
import CompleteMission from "../roles/user/CompleteMission";
import VoiceCall from "../roles/user/VoiceCall";
import VideoCall from "../roles/user/VideoCall";
import MyIncidents from "../roles/user/MyIncidents";
import EmergencyProfileView from "../roles/user/EmergencyProfileView";
import AccountSettings from "../roles/user/AccountSettings";
import { ProtectedRoute } from "../components/shared/ProtectedRoute";

export const UserRouteElements = (
  <>
    {/* Public routes */}
    <Route path="/" element={<SOSpage />} />
    <Route path="/signin" element={<Signin />} />
    <Route path="/signup" element={<SignUp />} />

    {/* Civilian-protected routes */}
    <Route element={<ProtectedRoute allowedRoles={["CIVILIAN"]} redirectTo="/signin" />}>
      <Route path="/setup-profile" element={<EmergencyProfileSetup />} />
      <Route path="/choosehelp" element={<ChooseHelp />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/map" element={<Map />} />
      <Route path="/completemission" element={<CompleteMission />} />
      <Route path="/voicecall" element={<VoiceCall />} />
      <Route path="/videocall" element={<VideoCall />} />
      <Route path="/my-incidents" element={<MyIncidents />} />
      <Route path="/emergency-profile" element={<EmergencyProfileView />} />
      <Route path="/account-settings" element={<AccountSettings />} />
    </Route>
  </>
);

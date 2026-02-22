import { Routes, Route } from 'react-router-dom';
import SOSpage from '../pages/SOSpage';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import EmergencyProfileSetup from '../pages/EmergencyProfileSetup';
import ChooseHelp from '../pages/ChooseHelp';
import Chat from '../pages/Chat';
import Map from '../pages/Map';
import CompleteMission from '../pages/CompleteMission';
import VoiceCall from '../pages/VoiceCall';
import VideoCall from '../pages/VideoCall';

export const UserRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<SOSpage />} />
      <Route path="/Login" element={<Login />} />
      <Route path="/SignUp" element={<SignUp />} />
      <Route path="/setup-profile" element={<EmergencyProfileSetup />} />
      <Route path="/ChooseHelp" element={<ChooseHelp />} />
      <Route path="/Chat" element={<Chat />} />
      <Route path="/Map" element={<Map />} />
      <Route path="/CompleteMission" element={<CompleteMission />} />
      <Route path="/VoiceCall" element={<VoiceCall />} />
      <Route path="/VideoCall" element={<VideoCall />} />
    </Routes>
  );
};

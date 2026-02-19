import { Routes, Route } from 'react-router-dom';
import SOSpage from '../pages/SOSpage';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/choosehelp" element={<ChooseHelp />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/map" element={<Map />} />
      <Route path="/completemission" element={<CompleteMission />} />
      <Route path="/voicecall" element={<VoiceCall />} />
      <Route path="/videocall" element={<VideoCall />} />
    </Routes>
  );
};

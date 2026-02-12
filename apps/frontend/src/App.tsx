import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SOSpage from './pages/SOSpage';
import Login from './pages/Login';
import SignUp from './pages/signup';
import ChooseHelp from './pages/ChooseHelp';
import Chat from './pages/Chat';
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SOSpage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/choosehelp" element={<ChooseHelp />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  );
}

export default App;

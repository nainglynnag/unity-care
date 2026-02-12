import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SOSpage from './pages/SOSpage';
import Login from './pages/login';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SOSpage />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;

import { BrowserRouter as Router, Routes } from 'react-router-dom';
import { UserRouteElements } from './routes/user.route';
import { VolunteerRouteElements } from './routes/volunteer.route';
import './App.css'

function User() {
  return (
    <Router>
      <Routes>
        {/* Volunteer routes first so /volunteer-signin etc. match */}
        {VolunteerRouteElements}
        {/* User routes */}
        {UserRouteElements}
      </Routes>
    </Router>
  );
}

export default User;

import { BrowserRouter as Router } from 'react-router-dom';
import { UserRoutes } from './routes';
import './App.css'

function User() {
  return (
    <Router>
      <UserRoutes />
    </Router>
  );
}

export default User;

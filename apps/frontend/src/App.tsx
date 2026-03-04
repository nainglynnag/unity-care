import { BrowserRouter as Router, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { UserRouteElements } from "./routes/user.route";
import { VolunteerRouteElements } from "./routes/volunteer.route";
import { AdminRouteElements } from "./routes/admin.route";
import "./App.css";

function App() {
  return (
    <>
      <Router>
        <Routes>
          {/* Admin routes (ADMIN / SUPERADMIN) */}
          {AdminRouteElements}
          {/* Volunteer routes (VOLUNTEER) */}
          {VolunteerRouteElements}
          {/* Civilian / public routes */}
          {UserRouteElements}
        </Routes>
      </Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#020617",
            color: "#f9fafb",
            border: "1px solid #4b5563",
          },
        }}
      />
    </>
  );
}

export default App;

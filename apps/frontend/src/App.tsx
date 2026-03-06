import { Suspense } from "react";
import { BrowserRouter as Router, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { UserRouteElements } from "./routes/user.route";
import { VolunteerRouteElements } from "./routes/volunteer.route";
import { AdminRouteElements } from "./routes/admin.route";
import "./App.css";

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-slate-200" />
    </div>
  );
}

function App() {
  return (
    <>
      <Router>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Admin routes (ADMIN / SUPERADMIN) */}
            {AdminRouteElements}
            {/* Volunteer routes (VOLUNTEER) */}
            {VolunteerRouteElements}
            {/* Civilian / public routes */}
            {UserRouteElements}
          </Routes>
        </Suspense>
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

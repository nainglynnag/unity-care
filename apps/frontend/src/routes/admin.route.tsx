import { Route } from "react-router-dom";
import Signin from "../roles/user/signin";
import { ProtectedRoute } from "../components/shared/ProtectedRoute";
import { AdminLayout } from "../components/admin/AdminLayout";
import AdminDashboard from "../roles/admin/AdminDashboard";
import AdminUsers from "../roles/admin/AdminUsers";
import AdminApplications from "../roles/admin/AdminApplications";
import AdminVolunteerRoles from "../roles/admin/AdminVolunteerRoles";
import AdminReferenceData from "../roles/admin/AdminReferenceData";
import AdminAnalytics from "../roles/admin/AdminAnalytics";

export const AdminRouteElements = (
  <>
    <Route path="/admin-signin" element={<Signin />} />
    <Route element={<ProtectedRoute allowedRoles={["ADMIN", "SUPERADMIN"]} redirectTo="/admin-signin" />}>
      <Route path="/admin-dashboard" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="applications" element={<AdminApplications />} />
        <Route path="volunteer-roles" element={<AdminVolunteerRoles />} />
        <Route path="reference-data" element={<AdminReferenceData />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>
    </Route>
  </>
);

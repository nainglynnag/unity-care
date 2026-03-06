import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "../components/shared/ProtectedRoute";
import { AdminLayout } from "../components/admin/AdminLayout";

const Signin = lazy(() => import("../roles/user/signin"));
const AdminDashboard = lazy(() => import("../roles/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("../roles/admin/AdminUsers"));
const AdminApplications = lazy(() => import("../roles/admin/AdminApplications"));
const AdminVolunteerRoles = lazy(() => import("../roles/admin/AdminVolunteerRoles"));
const AdminReferenceData = lazy(() => import("../roles/admin/AdminReferenceData"));
const AdminAnalytics = lazy(() => import("../roles/admin/AdminAnalytics"));

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export const AdminRouteElements = (
  <>
    <Route path="/admin-signin" element={<LazyWrap><Signin /></LazyWrap>} />
    <Route element={<ProtectedRoute allowedRoles={["ADMIN", "SUPERADMIN"]} redirectTo="/admin-signin" />}>
      <Route path="/admin-dashboard" element={<AdminLayout />}>
        <Route index element={<LazyWrap><AdminDashboard /></LazyWrap>} />
        <Route path="users" element={<LazyWrap><AdminUsers /></LazyWrap>} />
        <Route path="applications" element={<LazyWrap><AdminApplications /></LazyWrap>} />
        <Route path="volunteer-roles" element={<LazyWrap><AdminVolunteerRoles /></LazyWrap>} />
        <Route path="reference-data" element={<LazyWrap><AdminReferenceData /></LazyWrap>} />
        <Route path="analytics" element={<LazyWrap><AdminAnalytics /></LazyWrap>} />
      </Route>
    </Route>
  </>
);

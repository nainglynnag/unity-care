import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword, deleteAccount, signoutAll } from "../../lib/account";
import { getRefreshToken, clearAuthTokens } from "../../lib/api";
import Header from "../../components/user/Header";
import toast from "react-hot-toast";
import { Lock, LogOut, Trash2, Loader2, ShieldAlert } from "lucide-react";

export default function AccountSettings() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [signoutAllLoading, setSignoutAllLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match");
      return;
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    setChangePwLoading(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
        refreshToken,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    setSignoutAllLoading(true);
    try {
      await signoutAll();
      clearAuthTokens();
      toast.success("Signed out from all devices");
      navigate("/signin", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign out");
      setSignoutAllLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error('Type "DELETE" to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteAccount();
      clearAuthTokens();
      toast.success("Account deleted");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Account Settings</h1>

        {/* Card 1: Change Password */}
        <section className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={changePwLoading}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changePwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Change Password
            </button>
          </form>
        </section>

        {/* Card 2: Sign Out All Sessions */}
        <section className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <LogOut className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium">Sign Out All Sessions</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">Sign out from all devices</p>
          <button
            onClick={handleSignOutAll}
            disabled={signoutAllLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signoutAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign Out All
          </button>
        </section>

        {/* Card 3: Delete Account (Danger Zone) */}
        <section className="bg-gray-900/80 border-2 border-red-900/80 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-medium text-red-400">Delete Account</h2>
          </div>
          <p className="text-red-300/90 text-sm mb-4">
            This action cannot be undone. All your data will be permanently removed.
          </p>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5">
              Type <span className="font-mono text-red-400">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-2.5 bg-gray-800 border border-red-900/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteLoading || deleteConfirmation !== "DELETE"}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-900 hover:bg-red-800 text-red-100 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete My Account
          </button>
        </section>
      </main>
    </div>
  );
}

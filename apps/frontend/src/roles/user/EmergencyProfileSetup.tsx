import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/Header";
import { API_BASE, authFetch, getCurrentUser } from "../../lib/api";
import { createEmergencyProfile } from "../../lib/emergencyProfile";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function EmergencyProfileSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const passedName = (location.state as { fullName?: string })?.fullName ?? "";

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRelationship, setContactRelationship] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (passedName) {
      setFullName(passedName);
    } else if (user?.name) {
      setFullName(user.name);
    }
    if (user?.phone) {
      if (user.phone.startsWith("g-")) {
        setRequirePhone(true);
      } else {
        setPhone(user.phone);
      }
    } else {
      setRequirePhone(true);
    }
  }, [passedName]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setApiError("");
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setApiError("Full name must be at least 2 characters.");
      return;
    }
    const normalizedPhone = phone.trim().replace(/\s/g, "");
    if (requirePhone && !normalizedPhone) {
      setApiError("Phone number is required.");
      return;
    }
    setLoading(true);
    try {
      // If Google sign-up placeholder phone is present, update account phone first.
      if (requirePhone) {
        const res = await authFetch(`${API_BASE}/account/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            phone: normalizedPhone,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          const msg =
            json?.error?.message ??
            json?.meta?.message ??
            "Failed to update phone number.";
          setApiError(msg);
          return;
        }
      }

      const body = {
        fullName: trimmedName,
        consentGivenAt: new Date().toISOString(),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth).toISOString() }),
        ...(bloodType && { bloodType: bloodType as "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" }),
        ...(allergies.trim() && { allergies: allergies.trim() }),
        ...(medicalConditions.trim() && { medicalConditions: medicalConditions.trim() }),
        ...(medications.trim() && { medications: medications.trim() }),
        ...(contactName.trim() && contactPhone.trim() && {
          contacts: [{
            name: contactName.trim(),
            phone: contactPhone.trim().replace(/\s/g, ""),
            ...(contactRelationship.trim() && { relationship: contactRelationship.trim() }),
            isPrimary: true,
          }],
        }),
      };
      await createEmergencyProfile(body);
      navigate("/choosehelp", { replace: true });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (!res.ok) {
        navigate("/login", { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      {/* Back Arrow Button - Under Logo */}
      <div className="px-6 pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">Back</span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 1C8.13 1 5 4.13 5 8C5 11.87 8.13 15 12 15C15.87 15 19 11.87 19 8C19 4.13 15.87 1 12 1ZM12 13C9.24 13 7 10.76 7 8C7 5.24 9.24 3 12 3C14.76 3 17 5.24 17 8C17 10.76 14.76 13 12 13Z"
                  fill="white"
                />
                <path d="M12 15C7.58 15 4 18.58 4 23H20C20 18.58 16.42 15 12 15Z" fill="white" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-white text-3xl font-bold text-center mb-2">Emergency Profile</h1>
          <p className="text-white/70 text-sm text-center mb-6">
            Optional. Help responders with medical info and a contact. You can skip and add this later.
          </p>

          <div className="mt-6 space-y-6">
            {apiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900/60 border border-gray-800 rounded-2xl px-5 py-6 shadow-lg shadow-black/30">
              {requirePhone && (
                <div className="grid grid-cols-1 md:grid-cols-[1.4fr,1fr] gap-4 items-start">
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Phone number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-white/60 md:mt-8">
                    Required for accounts created with Google sign up. We’ll only use this to keep your account secure.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Date of birth (optional)</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">
                    Blood type (optional)
                  </label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select…</option>
                    {BLOOD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">
                    Allergies (optional)
                  </label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, nuts"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">
                    Medical conditions (optional)
                  </label>
                  <input
                    type="text"
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder="e.g. Diabetes, asthma"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">
                    Medications (optional)
                  </label>
                  <input
                    type="text"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="e.g. Insulin, inhaler"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800">
                <p className="text-white/80 text-sm font-medium mb-3">Emergency contact (optional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact name"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Phone (e.g. +1234567890)"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Relationship</label>
                  <input
                    type="text"
                    value={contactRelationship}
                    onChange={(e) => setContactRelationship(e.target.value)}
                    placeholder="Relationship (e.g. Spouse)"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
                >
                  {loading ? "Saving…" : "Save & Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmergencyProfileSetup;

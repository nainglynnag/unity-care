import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import Header from "../../components/user/Header";
import { API_BASE, getAccessToken, setAuthTokens, setCurrentUser } from "../../lib/api";
import {
  getAgencies,
  getSkills,
  submitVolunteerApplication,
  type Agency,
  type Skill,
} from "../../lib/volunteerApplication";

type Step = "register" | "application";

function isAtLeast18(dateStr: string): boolean {
  if (!dateStr) return true;
  const dob = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

export default function VolunteerApplication() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [appForm, setAppForm] = useState({
    agencyId: "",
    skillIds: [] as string[],
    dateOfBirth: "",
    nationalIdNumber: "",
    nationalIdUrl: "",
    address: "",
    hasTransport: false,
    experience: "",
    consentGiven: false,
  });

  useEffect(() => {
    if (getAccessToken()) {
      setStep("application");
    }
  }, []);

  useEffect(() => {
    if (step !== "application") return;
    setOptionsLoading(true);
    Promise.all([getAgencies(), getSkills()])
      .then(([a, s]) => {
        setAgencies(a);
        setSkills(s);
        if (a.length && !appForm.agencyId) setAppForm((f) => ({ ...f, agencyId: a[0].id }));
      })
      .catch(() => setError("Failed to load agencies and skills."))
      .finally(() => setOptionsLoading(false));
  }, [step]);

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleAppChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setAppForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleSkillMultiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setAppForm((prev) => ({ ...prev, skillIds: selected }));
    setError("");
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (registerForm.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.fullName.trim(),
          email: registerForm.email.trim(),
          phone: registerForm.phone.trim(),
          password: registerForm.password,
          confirmPassword: registerForm.confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const isAlreadyRegistered =
          res.status === 409 || json?.error?.code === "USER_ALREADY_REGISTERED";
        const details = json?.error?.details;
        const msg = details?.length
          ? details
              .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
              .join("; ")
          : json?.error?.message ||
            (isAlreadyRegistered
              ? "You are already registered. Please sign in instead."
              : "Registration failed. Please try again.");
        setError(msg);
        return;
      }
      const payload = json?.data;
      setAuthTokens(payload ?? {});
      setCurrentUser(payload?.user ?? null);
      setStep("application");
      setError("");
      setOptionsLoading(true);
      Promise.all([getAgencies(), getSkills()])
        .then(([a, s]) => {
          setAgencies(a);
          setSkills(s);
          if (a.length) setAppForm((f) => ({ ...f, agencyId: a[0].id }));
        })
        .finally(() => setOptionsLoading(false));
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!appForm.agencyId) {
      setError("Please select an agency.");
      return;
    }
    if (appForm.skillIds.length === 0) {
      setError("Please select at least one skill.");
      return;
    }
    if (!appForm.consentGiven) {
      setError("You must consent to the terms to apply.");
      return;
    }
    if (!isAtLeast18(appForm.dateOfBirth)) {
      setError("You must be at least 18 years old to apply.");
      return;
    }
    setLoading(true);
    try {
      await submitVolunteerApplication({
        agencyId: appForm.agencyId,
        skillIds: appForm.skillIds,
        dateOfBirth: appForm.dateOfBirth,
        nationalIdNumber: appForm.nationalIdNumber.trim(),
        nationalIdUrl: appForm.nationalIdUrl.trim(),
        address: appForm.address.trim(),
        hasTransport: appForm.hasTransport,
        experience: appForm.experience.trim() || undefined,
        consentGiven: true,
      });
      navigate("/volunteer-dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
  const labelClass = "block text-white/90 text-sm font-medium mb-2";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <div className="px-6 pt-6 pb-2">
        <button
          onClick={() => (step === "application" && getAccessToken() ? setStep("register") : navigate(-1))}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">Back</span>
        </button>
      </div>
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-gray-900 via-gray-950 to-gray-950 pointer-events-none" aria-hidden />
        <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" />
              </svg>
            </div>
          </div>
          <h1 className="text-white text-3xl font-bold text-center mb-2">Volunteer Application</h1>
          <p className="text-white/70 text-sm text-center mb-8">
            {step === "register"
              ? "Create an account, then complete your application."
              : "Complete your volunteer application."}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="7" r="4" />
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    value={registerForm.fullName}
                    onChange={handleRegisterChange}
                    placeholder="Your full name"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    placeholder="john@example.com"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3.02a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3.02a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={registerForm.phone}
                    onChange={handleRegisterChange}
                    placeholder="Enter your phone number"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                    placeholder="Create a password (min 8 characters)"
                    className={inputClass}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={registerForm.confirmPassword}
                    onChange={handleRegisterChange}
                    placeholder="Confirm your password"
                    className={inputClass}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue to application"}
              </button>
            </form>
          )}

          {step === "application" && (
            <form onSubmit={handleAppSubmit} className="space-y-4">
              {optionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Agency</label>
                    <select
                      name="agencyId"
                      value={appForm.agencyId}
                      onChange={handleAppChange}
                      className={`${inputClass} pl-4`}
                      required
                    >
                      <option value="">Select agency</option>
                      {agencies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.region ? ` (${a.region})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Skills (select at least one)</label>
                    <select
                      multiple
                      value={appForm.skillIds}
                      onChange={handleSkillMultiChange}
                      className={`${inputClass} pl-4 min-h-[100px]`}
                    >
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-white/50 text-xs mt-1">Hold Ctrl/Cmd to select multiple</p>
                  </div>
                  <div>
                    <label className={labelClass}>Date of birth (must be 18+)</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={appForm.dateOfBirth}
                      onChange={handleAppChange}
                      className={inputClass}
                      required
                    />
                    {appForm.dateOfBirth && !isAtLeast18(appForm.dateOfBirth) && (
                      <p className="mt-2 text-amber-400 text-sm flex items-center gap-1.5" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          <path d="M12 16h.01" />
                        </svg>
                        You must be at least 18 years old to apply.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>National ID number</label>
                    <input
                      type="text"
                      name="nationalIdNumber"
                      value={appForm.nationalIdNumber}
                      onChange={handleAppChange}
                      placeholder="At least 8 characters"
                      className={inputClass}
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>National ID document URL</label>
                    <input
                      type="url"
                      name="nationalIdUrl"
                      value={appForm.nationalIdUrl}
                      onChange={handleAppChange}
                      placeholder="https://..."
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={appForm.address}
                      onChange={handleAppChange}
                      placeholder="Full address (min 5 characters)"
                      className={inputClass}
                      required
                      minLength={5}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasTransport"
                      name="hasTransport"
                      checked={appForm.hasTransport}
                      onChange={handleAppChange}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                    />
                    <label htmlFor="hasTransport" className="text-white/90 text-sm">
                      I have my own transport
                    </label>
                  </div>
                  <div>
                    <label className={labelClass}>Experience (optional, max 500 chars)</label>
                    <textarea
                      name="experience"
                      value={appForm.experience}
                      onChange={handleAppChange}
                      placeholder="Briefly describe your field experience..."
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="consentGiven"
                      name="consentGiven"
                      checked={appForm.consentGiven}
                      onChange={handleAppChange}
                      className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                    />
                    <label htmlFor="consentGiven" className="text-white/90 text-sm">
                      I consent to the terms and conditions and confirm that the information I provide is accurate.
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || optionsLoading}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit application"}
                  </button>
                </>
              )}
            </form>
          )}

          <p className="text-center mt-6 text-white/70 text-sm">
            Already have an account?{" "}
            <Link to="/volunteer-signin" className="text-red-500 hover:text-red-400 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <footer className="w-full bg-gray-900 border-t border-gray-800 px-6 py-3 flex items-center justify-center gap-2 text-white/60 text-xs">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>OFFICIAL UNITY CARE RECRUITMENT</span>
      </footer>
    </div>
  );
}

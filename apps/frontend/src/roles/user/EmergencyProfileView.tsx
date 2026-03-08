import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyEmergencyProfile,
  updateEmergencyProfile,
  type EmergencyProfile,
  type EmergencyContactInput,
} from "../../lib/emergencyProfile";
import Header from "../../components/user/Header";
import toast from "react-hot-toast";
import {
  Heart,
  Loader2,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Phone,
  AlertTriangle,
} from "lucide-react";

const BLOOD_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "A+": { bg: "bg-green-600", text: "text-white" },
  "A-": { bg: "bg-green-800/80", text: "text-green-200" },
  "B+": { bg: "bg-blue-600", text: "text-white" },
  "B-": { bg: "bg-blue-800/80", text: "text-blue-200" },
  "AB+": { bg: "bg-purple-600", text: "text-white" },
  "AB-": { bg: "bg-purple-800/80", text: "text-purple-200" },
  "O+": { bg: "bg-red-600", text: "text-white" },
  "O-": { bg: "bg-red-800/80", text: "text-red-200" },
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const MAX_CONTACTS = 5;

const EMERGENCY_PROFILE_IMAGE_KEY = "emergency-profile-image-url";

function getStoredImageUrl(userId: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(`${EMERGENCY_PROFILE_IMAGE_KEY}-${userId}`) ?? "";
}

function setStoredImageUrl(userId: string, url: string) {
  if (typeof window === "undefined") return;
  if (url.trim()) {
    localStorage.setItem(`${EMERGENCY_PROFILE_IMAGE_KEY}-${userId}`, url.trim());
  } else {
    localStorage.removeItem(`${EMERGENCY_PROFILE_IMAGE_KEY}-${userId}`);
  }
}

function getBloodTypeBadgeClass(bloodType: string | null | undefined): string {
  if (!bloodType) return "bg-gray-700 text-gray-300";
  const style = BLOOD_TYPE_COLORS[bloodType];
  return style ? `${style.bg} ${style.text}` : "bg-gray-700 text-gray-300";
}

export default function EmergencyProfileView() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [localImageUrl, setLocalImageUrl] = useState("");
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  // Edit form state (imageUrl is frontend-only, not sent to API)
  const [editForm, setEditForm] = useState({
    fullName: "",
    dateOfBirth: "",
    bloodType: "" as string,
    allergies: "",
    medicalConditions: "",
    medications: "",
    imageUrl: "",
    contacts: [] as EmergencyContactInput[],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyEmergencyProfile();
        if (cancelled) return;
        setProfile(data);
        if (data) {
          const savedImageUrl = getStoredImageUrl(data.userId);
          setLocalImageUrl(savedImageUrl);
          setProfileImageFailed(false);
          setEditForm({
            fullName: data.fullName ?? "",
            dateOfBirth: data.dateOfBirth ?? "",
            bloodType: data.bloodType ?? "",
            allergies: data.allergies ?? "",
            medicalConditions: data.medicalConditions ?? "",
            medications: data.medications ?? "",
            imageUrl: savedImageUrl,
            contacts: (data.contacts ?? []).map((c) => ({
              name: c.name,
              phone: c.phone,
              relationship: c.relationship ?? "",
              isPrimary: c.isPrimary ?? false,
            })),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetEditForm = () => {
    if (profile) {
      setEditForm(() => ({
        fullName: profile.fullName ?? "",
        dateOfBirth: profile.dateOfBirth ?? "",
        bloodType: profile.bloodType ?? "",
        allergies: profile.allergies ?? "",
        medicalConditions: profile.medicalConditions ?? "",
        medications: profile.medications ?? "",
        imageUrl: localImageUrl,
        contacts: (profile.contacts ?? []).map((c) => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship ?? "",
          isPrimary: c.isPrimary ?? false,
        })),
      }));
    }
    setIsEditing(false);
  };

  const getChangedBody = () => {
    if (!profile) return null;
    const body: Record<string, unknown> = {};
    if (editForm.fullName !== (profile.fullName ?? "")) body.fullName = editForm.fullName;
    if (editForm.dateOfBirth !== (profile.dateOfBirth ?? "")) body.dateOfBirth = editForm.dateOfBirth;
    if (editForm.bloodType !== (profile.bloodType ?? "")) body.bloodType = editForm.bloodType;
    if (editForm.allergies !== (profile.allergies ?? "")) body.allergies = editForm.allergies;
    if (editForm.medicalConditions !== (profile.medicalConditions ?? ""))
      body.medicalConditions = editForm.medicalConditions;
    if (editForm.medications !== (profile.medications ?? "")) body.medications = editForm.medications;

    const originalContacts = (profile.contacts ?? []).map((c) => ({
      name: c.name,
      phone: c.phone,
      relationship: c.relationship ?? "",
      isPrimary: c.isPrimary ?? false,
    }));
    const contactsChanged =
      JSON.stringify(editForm.contacts) !== JSON.stringify(originalContacts);
    if (contactsChanged) body.contacts = editForm.contacts;

    return Object.keys(body).length > 0 ? body : null;
  };

  const handleSave = async () => {
    const body = getChangedBody();
    const imageUrlChanged = editForm.imageUrl.trim() !== localImageUrl.trim();

    if (!body && !imageUrlChanged) {
      toast.success("No changes to save");
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      if (body) {
        const updated = await updateEmergencyProfile(body);
        setProfile(updated);
        setEditForm((prev) => ({
          fullName: updated.fullName ?? "",
          dateOfBirth: updated.dateOfBirth ?? "",
          bloodType: updated.bloodType ?? "",
          allergies: updated.allergies ?? "",
          medicalConditions: updated.medicalConditions ?? "",
          medications: updated.medications ?? "",
          imageUrl: prev.imageUrl,
          contacts: (updated.contacts ?? []).map((c) => ({
            name: c.name,
            phone: c.phone,
            relationship: c.relationship ?? "",
            isPrimary: c.isPrimary ?? false,
          })),
        }));
      }

      if (imageUrlChanged && profile?.userId) {
        setStoredImageUrl(profile.userId, editForm.imageUrl.trim());
        setLocalImageUrl(editForm.imageUrl.trim());
        setProfileImageFailed(false);
        window.dispatchEvent(new CustomEvent("unitycare:emergency-profile-image-updated"));
      }

      setIsEditing(false);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const addContact = () => {
    if (editForm.contacts.length >= MAX_CONTACTS) {
      toast.error(`Maximum ${MAX_CONTACTS} contacts allowed`);
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: "", phone: "", relationship: "", isPrimary: prev.contacts.length === 0 }],
    }));
  };

  const removeContact = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index).map((c, i) => ({ ...c, isPrimary: i === 0 })),
    }));
  };

  const setPrimaryContact = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({ ...c, isPrimary: i === index })),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-red-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 px-6">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <p className="text-gray-300 text-center mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 px-6">
          <Heart className="h-16 w-16 text-gray-600 mb-6" />
          <h2 className="text-xl font-semibold text-white mb-2">No emergency profile set up</h2>
          <p className="text-gray-400 text-center mb-8 max-w-md">
            Set up your emergency profile so first responders can access critical medical information when you need help.
          </p>
          <button
            onClick={() => navigate("/setup-profile")}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Set up profile
          </button>
        </div>
      </div>
    );
  }

  const formatDateDisplay = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return iso;
    }
  };

  const inputClass =
    "w-full bg-gray-800/80 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 outline-none transition-shadow";
  const labelClass = "block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 text-red-400">
              <Heart className="h-6 w-6" />
            </span>
            Emergency Profile
          </h1>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="self-start sm:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              aria-label="Edit profile"
            >
              <Pencil className="h-4 w-4" />
              Edit profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={resetEditForm}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium transition-colors shadow-lg shadow-red-900/20"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Profile photo card */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/20">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Profile Photo</h2>
            {isEditing ? (
              <input
                type="url"
                value={editForm.imageUrl}
                onChange={(e) => setEditForm((p) => ({ ...p, imageUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://example.com/your-photo.jpg"
              />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                  {localImageUrl && !profileImageFailed ? (
                    <img
                      src={localImageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setProfileImageFailed(true)}
                    />
                  ) : (
                    <Heart className="h-10 w-10 text-gray-600" />
                  )}
                </div>
                <div className="text-center sm:text-left">
                  {localImageUrl && !profileImageFailed ? (
                    <p className="text-gray-400 text-sm">Photo added</p>
                  ) : (
                    <p className="text-gray-500 text-sm">Add a photo URL in edit mode</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Personal info */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/30">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Personal information</h2>
            </div>
            <div className="divide-y divide-gray-800">
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Full name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                    className={inputClass}
                    placeholder="Your full name"
                  />
                ) : (
                  <p className="text-white font-medium text-lg">{profile.fullName || "—"}</p>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Date of birth</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                    className={inputClass}
                  />
                ) : (
                  <p className="text-gray-300">{formatDateDisplay(profile.dateOfBirth)}</p>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Blood type</label>
                {isEditing ? (
                  <select
                    value={editForm.bloodType}
                    onChange={(e) => setEditForm((p) => ({ ...p, bloodType: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex px-4 py-2 rounded-xl text-sm font-semibold ${getBloodTypeBadgeClass(
                      profile.bloodType
                    )}`}
                  >
                    {profile.bloodType || "—"}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Medical info */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/30">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Medical information</h2>
            </div>
            <div className="divide-y divide-gray-800">
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Allergies</label>
                {isEditing ? (
                  <textarea
                    value={editForm.allergies}
                    onChange={(e) => setEditForm((p) => ({ ...p, allergies: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="List any allergies"
                  />
                ) : (
                  <p className="text-gray-300 whitespace-pre-wrap">{profile.allergies || "—"}</p>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Medical conditions</label>
                {isEditing ? (
                  <textarea
                    value={editForm.medicalConditions}
                    onChange={(e) => setEditForm((p) => ({ ...p, medicalConditions: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="List any medical conditions"
                  />
                ) : (
                  <p className="text-gray-300 whitespace-pre-wrap">{profile.medicalConditions || "—"}</p>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <label className={labelClass}>Medications</label>
                {isEditing ? (
                  <textarea
                    value={editForm.medications}
                    onChange={(e) => setEditForm((p) => ({ ...p, medications: e.target.value }))}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="List current medications"
                  />
                ) : (
                  <p className="text-gray-300 whitespace-pre-wrap">{profile.medications || "—"}</p>
                )}
              </div>
            </div>
          </section>

          {/* Emergency contacts */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/30 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Emergency contacts</h2>
              {isEditing && editForm.contacts.length < MAX_CONTACTS && (
                <button
                  onClick={addContact}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add contact
                </button>
              )}
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              {!isEditing && (!profile.contacts || profile.contacts.length === 0) && (
                <p className="text-gray-500 py-4">No emergency contacts added yet.</p>
              )}

              {!isEditing &&
                profile.contacts?.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-700/80 shrink-0">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{c.name}</span>
                        {c.isPrimary && (
                          <span className="px-2 py-0.5 bg-red-600/30 text-red-400 text-xs font-medium rounded-lg">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{c.phone}</p>
                      {c.relationship && (
                        <p className="text-gray-500 text-sm mt-0.5">{c.relationship}</p>
                      )}
                    </div>
                  </div>
                ))}

              {isEditing &&
                editForm.contacts.map((contact, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        Contact {index + 1}
                        {contact.isPrimary && (
                          <span className="ml-2 text-red-400">(Primary)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {!contact.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryContact(index)}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Set primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-700/50 transition-colors"
                          aria-label="Remove contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            contacts: p.contacts.map((c, i) =>
                              i === index ? { ...c, name: e.target.value } : c
                            ),
                          }))
                        }
                        placeholder="Name"
                        className={`${inputClass} text-sm`}
                      />
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            contacts: p.contacts.map((c, i) =>
                              i === index ? { ...c, phone: e.target.value } : c
                            ),
                          }))
                        }
                        placeholder="Phone"
                        className={`${inputClass} text-sm`}
                      />
                      <input
                        type="text"
                        value={contact.relationship}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            contacts: p.contacts.map((c, i) =>
                              i === index ? { ...c, relationship: e.target.value } : c
                            ),
                          }))
                        }
                        placeholder="Relationship"
                        className={`${inputClass} text-sm sm:col-span-2`}
                      />
                    </div>
                  </div>
                ))}

              {isEditing && editForm.contacts.length === 0 && (
                <p className="text-gray-500 py-6 text-center text-sm">No contacts yet. Click &quot;Add contact&quot; above.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

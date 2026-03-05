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

  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: "",
    dateOfBirth: "",
    bloodType: "" as string,
    allergies: "",
    medicalConditions: "",
    medications: "",
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
          setEditForm({
            fullName: data.fullName ?? "",
            dateOfBirth: data.dateOfBirth ?? "",
            bloodType: data.bloodType ?? "",
            allergies: data.allergies ?? "",
            medicalConditions: data.medicalConditions ?? "",
            medications: data.medications ?? "",
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
      setEditForm({
        fullName: profile.fullName ?? "",
        dateOfBirth: profile.dateOfBirth ?? "",
        bloodType: profile.bloodType ?? "",
        allergies: profile.allergies ?? "",
        medicalConditions: profile.medicalConditions ?? "",
        medications: profile.medications ?? "",
        contacts: (profile.contacts ?? []).map((c) => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship ?? "",
          isPrimary: c.isPrimary ?? false,
        })),
      });
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
    if (!body) {
      toast.success("No changes to save");
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateEmergencyProfile(body);
      setProfile(updated);
      setEditForm({
        fullName: updated.fullName ?? "",
        dateOfBirth: updated.dateOfBirth ?? "",
        bloodType: updated.bloodType ?? "",
        allergies: updated.allergies ?? "",
        medicalConditions: updated.medicalConditions ?? "",
        medications: updated.medications ?? "",
        contacts: (updated.contacts ?? []).map((c) => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship ?? "",
          isPrimary: c.isPrimary ?? false,
        })),
      });
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="h-7 w-7 text-red-500" />
            Emergency Profile
          </h1>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              aria-label="Edit profile"
            >
              <Pencil className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={resetEditForm}
                disabled={saving}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Full name */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.fullName}
                onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none"
                placeholder="Your full name"
              />
            ) : (
              <p className="text-white font-medium">{profile.fullName || "—"}</p>
            )}
          </div>

          {/* Date of birth */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Date of Birth
            </label>
            {isEditing ? (
              <input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none"
              />
            ) : (
              <p className="text-gray-300">{profile.dateOfBirth || "—"}</p>
            )}
          </div>

          {/* Blood type */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Blood Type
            </label>
            {isEditing ? (
              <select
                value={editForm.bloodType}
                onChange={(e) => setEditForm((p) => ({ ...p, bloodType: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none"
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
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getBloodTypeBadgeClass(
                  profile.bloodType
                )}`}
              >
                {profile.bloodType || "—"}
              </span>
            )}
          </div>

          {/* Allergies */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Allergies
            </label>
            {isEditing ? (
              <textarea
                value={editForm.allergies}
                onChange={(e) => setEditForm((p) => ({ ...p, allergies: e.target.value }))}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none resize-none"
                placeholder="List any allergies"
              />
            ) : (
              <p className="text-gray-300 whitespace-pre-wrap">{profile.allergies || "—"}</p>
            )}
          </div>

          {/* Medical conditions */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Medical Conditions
            </label>
            {isEditing ? (
              <textarea
                value={editForm.medicalConditions}
                onChange={(e) => setEditForm((p) => ({ ...p, medicalConditions: e.target.value }))}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none resize-none"
                placeholder="List any medical conditions"
              />
            ) : (
              <p className="text-gray-300 whitespace-pre-wrap">{profile.medicalConditions || "—"}</p>
            )}
          </div>

          {/* Medications */}
          <div className="p-4 sm:p-6 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Medications
            </label>
            {isEditing ? (
              <textarea
                value={editForm.medications}
                onChange={(e) => setEditForm((p) => ({ ...p, medications: e.target.value }))}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none resize-none"
                placeholder="List current medications"
              />
            ) : (
              <p className="text-gray-300 whitespace-pre-wrap">{profile.medications || "—"}</p>
            )}
          </div>

          {/* Emergency contacts */}
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Emergency Contacts
              </label>
              {isEditing && editForm.contacts.length < MAX_CONTACTS && (
                <button
                  onClick={addContact}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-400 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add contact
                </button>
              )}
            </div>

            {!isEditing && (!profile.contacts || profile.contacts.length === 0) && (
              <p className="text-gray-500">No emergency contacts</p>
            )}

            {!isEditing &&
              profile.contacts?.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg mb-3 last:mb-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{c.name}</span>
                      {c.isPrimary && (
                        <span className="px-2 py-0.5 bg-red-600/30 text-red-400 text-xs rounded-md">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      {c.phone}
                    </div>
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
                  className="flex flex-col gap-2 p-3 bg-gray-800/50 rounded-lg mb-3 last:mb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
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
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
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
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none text-sm"
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
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none text-sm"
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
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 sm:col-span-2 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none text-sm"
                    />
                  </div>
                </div>
              ))}

            {isEditing && editForm.contacts.length === 0 && (
              <p className="text-gray-500 py-2">No contacts. Click &quot;Add contact&quot; to add one.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

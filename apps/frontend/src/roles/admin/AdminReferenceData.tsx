import { useState, useEffect } from "react";
import {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createAgency,
  updateAgency,
  deleteAgency,
  type Skill,
  type Category,
} from "@/lib/referenceData";
import { getAgencies, type Agency } from "@/lib/admin";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Layers,
  Building2,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from "lucide-react";

type TabId = "skills" | "categories" | "agencies";

const TABS: { id: TabId; label: string; icon: typeof Tag }[] = [
  { id: "skills", label: "Skills", icon: Tag },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "agencies", label: "Agencies", icon: Building2 },
];

// ── Shared components ──

function ActiveToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const Icon = checked ? ToggleRight : ToggleLeft;
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs font-medium transition-opacity disabled:opacity-50 ${
        checked ? "text-emerald-400" : "text-gray-400"
      }`}
    >
      <Icon className="w-5 h-5" />
      {checked ? "Active" : "Inactive"}
    </button>
  );
}

function DeleteConfirmModal({
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white text-lg font-bold">{title}</h3>
            <p className="text-white/60 text-sm mt-0.5">
              {message}
              {itemName && <span className="text-white font-medium"> {itemName}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skills section ──

function SkillsSection() {
  const [items, setItems] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getSkills();
      setItems(data);
    } catch {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setModalOpen(true);
  };

  const openEdit = (item: Skill) => {
    setEditing(item);
    setFormName(item.name);
    setFormDesc(item.description ?? "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitLoading(true);
    try {
      if (editing) {
        await updateSkill(editing.id, { name: formName.trim(), description: formDesc.trim() || undefined });
        toast.success("Skill updated");
      } else {
        await createSkill({ name: formName.trim(), description: formDesc.trim() || undefined });
        toast.success("Skill created");
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (item: Skill) => {
    try {
      await updateSkill(item.id, { isActive: !item.isActive });
      toast.success(item.isActive ? "Skill deactivated" : "Skill activated");
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteSkill(deleteTarget.id);
      toast.success("Skill deleted");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-400" />
          Skills
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <Tag className="w-10 h-10 text-white/20" />
          <p className="text-white/50 text-sm">No skills yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">NAME</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">DESCRIPTION</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIVE</th>
                <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-white/60 max-w-xs truncate">{item.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ActiveToggle
                      checked={item.isActive ?? false}
                      onChange={() => handleToggleActive(item)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">{editing ? "Edit Skill" : "Add Skill"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-white/70 text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. First Aid"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
              />
              <label className="block text-white/70 text-sm font-medium">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitLoading || !formName.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete Skill"
          message="Permanently delete"
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

// ── Categories section ──

function CategoriesSection() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setItems(data);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setModalOpen(true);
  };

  const openEdit = (item: Category) => {
    setEditing(item);
    setFormName(item.name);
    setFormDesc(item.description ?? "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitLoading(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { name: formName.trim(), description: formDesc.trim() || undefined });
        toast.success("Category updated");
      } else {
        await createCategory({ name: formName.trim(), description: formDesc.trim() || undefined });
        toast.success("Category created");
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (item: Category) => {
    try {
      await updateCategory(item.id, { isActive: !item.isActive });
      toast.success(item.isActive ? "Category deactivated" : "Category activated");
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCategory(deleteTarget.id);
      toast.success("Category deleted");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Categories
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <Layers className="w-10 h-10 text-white/20" />
          <p className="text-white/50 text-sm">No categories yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">NAME</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">DESCRIPTION</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIVE</th>
                <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-white/60 max-w-xs truncate">{item.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ActiveToggle
                      checked={item.isActive ?? false}
                      onChange={() => handleToggleActive(item)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">{editing ? "Edit Category" : "Add Category"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-white/70 text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Medical"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
              />
              <label className="block text-white/70 text-sm font-medium">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitLoading || !formName.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete Category"
          message="Permanently delete"
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

// ── Agencies section ──

function AgenciesSection() {
  const [items, setItems] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agency | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agency | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const result = await getAgencies({ perPage: 200 });
      setItems(result.agencies);
    } catch {
      toast.error("Failed to load agencies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormRegion("");
    setModalOpen(true);
  };

  const openEdit = (item: Agency) => {
    setEditing(item);
    setFormName(item.name);
    setFormDesc(item.description ?? "");
    setFormRegion(item.region ?? "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        region: formRegion.trim() || undefined,
      };
      if (editing) {
        await updateAgency(editing.id, payload);
        toast.success("Agency updated");
      } else {
        await createAgency(payload);
        toast.success("Agency created");
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (item: Agency) => {
    try {
      await updateAgency(item.id, { isActive: !item.isActive });
      toast.success(item.isActive ? "Agency deactivated" : "Agency activated");
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAgency(deleteTarget.id);
      toast.success("Agency deleted");
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Agencies
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <Building2 className="w-10 h-10 text-white/20" />
          <p className="text-white/50 text-sm">No agencies yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">NAME</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">REGION</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">DESCRIPTION</th>
                <th className="text-left px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIVE</th>
                <th className="text-right px-4 py-3 text-white/50 text-xs font-semibold tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-white/60">{item.region ?? "—"}</td>
                  <td className="px-4 py-3 text-white/60 max-w-xs truncate">{item.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ActiveToggle
                      checked={item.isActive ?? false}
                      onChange={() => handleToggleActive(item)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-bold">{editing ? "Edit Agency" : "Add Agency"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-white/70 text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Red Cross Regional"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
              />
              <label className="block text-white/70 text-sm font-medium">Region</label>
              <input
                type="text"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder="Optional region"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500"
              />
              <label className="block text-white/70 text-sm font-medium">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitLoading || !formName.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete Agency"
          message="Permanently delete"
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

// ── Main component ──

export default function AdminReferenceData() {
  const [activeTab, setActiveTab] = useState<TabId>("skills");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-black tracking-wide">REFERENCE DATA</h1>
        <p className="text-white/50 text-sm mt-1">Manage skills, categories, and agencies</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === id
                ? "bg-blue-500/20 text-blue-400"
                : "text-white/60 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "skills" && <SkillsSection />}
      {activeTab === "categories" && <CategoriesSection />}
      {activeTab === "agencies" && <AgenciesSection />}
    </div>
  );
}

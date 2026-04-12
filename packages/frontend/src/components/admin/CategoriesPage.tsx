import React, { useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import type { Category } from '@wizqueue/shared';

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<Category>;
  onSave: (data: { name: string; slug: string; description: string; sortOrder: number }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim(), sortOrder });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold" style={{ color: '#ff9900' }}>
        {initial?.id ? 'Edit Category' : 'Add Category'}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Name *</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Miniatures"
            required
            className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={inputSt}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>
            Slug *
            <span className="ml-1 font-normal text-iron-400">(URL-safe, unique)</span>
          </label>
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
            placeholder="e.g. miniatures"
            required
            className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            style={inputSt}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={inputSt}
        />
      </div>

      <div className="w-28">
        <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Sort Order</label>
        <input
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={inputSt}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isSaving} className="btn-primary btn-sm">
          {isSaving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add Category'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
      </div>
    </form>
  );
}

export const CategoriesPage: React.FC = () => {
  const { categories, isLoading, create, isCreating, update, isUpdating, remove } = useCategories();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: { name: string; slug: string; description: string; sortOrder: number }) => {
    await create(data);
    setShowAdd(false);
  };

  const handleUpdate = async (id: number, data: { name: string; slug: string; description: string; sortOrder: number }) => {
    await update(id, data);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-iron-50">Product Categories</h1>
            <p className="text-sm text-iron-400">
              Categories appear on the wiz3d-prints store. Add a product to a category via the product edit page.
            </p>
          </div>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">
            + Add Category
          </button>
        )}
      </div>

      {showAdd && (
        <CategoryForm
          onSave={handleCreate}
          onCancel={() => setShowAdd(false)}
          isSaving={isCreating}
        />
      )}

      {isLoading ? (
        <p className="text-iron-400 text-sm">Loading…</p>
      ) : categories.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-iron-400 text-sm">No categories yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id}>
              {editingId === cat.id ? (
                <CategoryForm
                  initial={cat}
                  onSave={(data) => handleUpdate(cat.id, data)}
                  onCancel={() => setEditingId(null)}
                  isSaving={isUpdating}
                />
              ) : (
                <div
                  className="card flex items-center gap-4"
                  style={{ padding: '0.75rem 1rem' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-iron-50">{cat.name}</span>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{ background: '#2d2d2d', color: '#9ca3af' }}
                      >
                        /{cat.slug}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: '#1d4ed8', color: '#ffffff' }}
                      >
                        order: {cat.sortOrder}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-iron-400 mt-0.5 truncate">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(cat.id)}
                      className="btn-secondary btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="btn-danger btn-sm"
                    >
                      {deletingId === cat.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

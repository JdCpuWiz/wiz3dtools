import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useShowcaseMaterials } from '../../../hooks/useShowcaseMaterials';
import { PageIcon } from '../../common/PageIcon';
import type { ShowcaseMaterial } from '../../../services/api';

export function ShowcaseMaterialsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { items, isLoading, createItem, updateItem, deleteItem, isCreating, isUpdating } = useShowcaseMaterials();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ShowcaseMaterial | null>(null);

  if (!isAdmin) return <div className="card text-center text-white">Admin access required.</div>;

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/filament-color-administration.png" alt="Materials" />
            <h1 className="text-2xl font-bold text-iron-50">Showcase — Materials</h1>
          </div>
          {!showCreate && !editTarget && (
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">+ New Material</button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Catalog of materials available on showcase.wiz3dprints.com/materials.
          Colors are hex values (e.g. <code className="text-xs">#ff9900</code>) — one per line.
        </p>
      </div>

      {showCreate && (
        <MaterialForm
          onCancel={() => setShowCreate(false)}
          onSubmit={async (data) => { await createItem(data); setShowCreate(false); }}
          isSaving={isCreating}
          mode="create"
        />
      )}

      {editTarget && (
        <MaterialForm
          existing={editTarget}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (data) => { await updateItem(editTarget.id, data); setEditTarget(null); }}
          isSaving={isUpdating}
          mode="edit"
        />
      )}

      {isLoading ? (
        <div className="card text-center text-white">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card text-center" style={{ color: '#9ca3af' }}>
          No materials yet. Click + New Material to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Properties</th>
                <th>Applications</th>
                <th>Colors</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...items].sort((a, b) => a.order - b.order).map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs" style={{ color: '#9ca3af' }}>{item.order}</td>
                  <td className="font-medium text-white">{item.name}</td>
                  <td style={{ color: '#9ca3af' }}>{item.properties.length}</td>
                  <td style={{ color: '#9ca3af' }}>{item.applications.length}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {item.colors.slice(0, 6).map((c, i) => (
                        <span key={i} title={c} className="inline-block w-4 h-4 rounded border" style={{ background: c, borderColor: '#2d2d2d' }} />
                      ))}
                      {item.colors.length > 6 && (
                        <span className="text-xs" style={{ color: '#9ca3af' }}>+{item.colors.length - 6}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => updateItem(item.id, { published: !item.published })}
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={item.published ? { background: '#15803d', color: '#ffffff' } : { background: '#6b7280', color: '#ffffff' }}
                    >
                      {item.published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditTarget(item)} className="btn-secondary btn-sm">Edit</button>
                      <button onClick={async () => { if (!confirm(`Delete "${item.name}"?`)) return; await deleteItem(item.id); }} className="btn-danger btn-sm">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface MaterialFormData extends Partial<ShowcaseMaterial> {
  name: string;
  description: string;
}

function MaterialForm({
  existing, onSubmit, onCancel, isSaving, mode,
}: {
  existing?: ShowcaseMaterial;
  onSubmit: (data: MaterialFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [propsText, setPropsText] = useState((existing?.properties ?? []).join('\n'));
  const [appsText, setAppsText] = useState((existing?.applications ?? []).join('\n'));
  const [colorsText, setColorsText] = useState((existing?.colors ?? []).join('\n'));
  const [orderNum, setOrderNum] = useState(existing?.order ?? 0);
  const [published, setPublished] = useState(existing?.published ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    const lines = (txt: string) => txt.split('\n').map((s) => s.trim()).filter(Boolean);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      properties: lines(propsText),
      applications: lines(appsText),
      colors: lines(colorsText),
      order: orderNum,
      published,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? 'New Material' : `Edit ${existing?.name ?? ''}`}
        </h2>
        <button onClick={onCancel} className="text-iron-500 hover:text-iron-300 text-lg leading-none">×</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Name *</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. PETG, PLA, PETG-CF" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Sort order</label>
          <input type="number" className="input w-full" value={orderNum} onChange={(e) => setOrderNum(parseInt(e.target.value || '0', 10))} min={0} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Description *</label>
          <textarea className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Properties (one per line)</label>
          <textarea className="input w-full" value={propsText} onChange={(e) => setPropsText(e.target.value)} rows={4} placeholder="High-strength&#10;UV-resistant" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Applications (one per line)</label>
          <textarea className="input w-full" value={appsText} onChange={(e) => setAppsText(e.target.value)} rows={4} placeholder="Functional parts&#10;Outdoor use" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Colors (hex, one per line)</label>
          <textarea className="input w-full font-mono text-xs" value={colorsText} onChange={(e) => setColorsText(e.target.value)} rows={3} placeholder="#ff9900&#10;#15803d&#10;#1d4ed8" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Published</label>
          <button
            type="button"
            onClick={() => setPublished((v) => !v)}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={published ? { background: '#15803d', color: '#ffffff' } : { background: '#6b7280', color: '#ffffff' }}
          >
            {published ? 'Published' : 'Draft'}
          </button>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSaving || !name.trim() || !description.trim()} className="btn-primary btn-sm">
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Material' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

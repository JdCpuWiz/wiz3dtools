import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useShowcaseServices } from '../../../hooks/useShowcaseServices';
import { PageIcon } from '../../common/PageIcon';
import type { ShowcaseService } from '../../../services/api';

/**
 * Showcase → Services admin (BuildPlan #11 Phase 4).
 *
 * Data + auth live in wiz3d-prints (existing Service Prisma model +
 * /api/services endpoints that accept X-Admin-Token as of wiz3d-prints
 * v1.8.0). This side is a thin proxy + admin UI mirroring
 * PortfolioPage from Phase 3.
 */
export function ShowcaseServicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { items, isLoading, createItem, updateItem, deleteItem, isCreating, isUpdating } =
    useShowcaseServices();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ShowcaseService | null>(null);

  if (!isAdmin) {
    return <div className="card text-center text-white">Admin access required.</div>;
  }

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/products.png" alt="Services" />
            <h1 className="text-2xl font-bold text-iron-50">Showcase — Services</h1>
          </div>
          {!showCreate && !editTarget && (
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
              + New Service
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Public service list on showcase.wiz3dprints.com/services. Icon
          paths/URLs must resolve from wiz3d-prints' public root (e.g.
          <code className="text-xs">/images/services/3d-printing.png</code>).
        </p>
      </div>

      {showCreate && (
        <ServiceForm
          onCancel={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await createItem(data);
            setShowCreate(false);
          }}
          isSaving={isCreating}
          mode="create"
        />
      )}

      {editTarget && (
        <ServiceForm
          existing={editTarget}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (data) => {
            await updateItem(editTarget.id, data);
            setEditTarget(null);
          }}
          isSaving={isUpdating}
          mode="edit"
        />
      )}

      {isLoading ? (
        <div className="card text-center text-white">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card text-center" style={{ color: '#9ca3af' }}>
          No services yet. Click + New Service to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Pricing</th>
                <th>Features</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...items]
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs" style={{ color: '#9ca3af' }}>
                      {item.order}
                    </td>
                    <td className="font-medium text-white">{item.title}</td>
                    <td style={{ color: '#9ca3af' }}>{item.pricing || '—'}</td>
                    <td style={{ color: '#9ca3af' }}>{item.features.length}</td>
                    <td>
                      <button
                        onClick={() => updateItem(item.id, { published: !item.published })}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          item.published
                            ? { background: '#15803d', color: '#ffffff' }
                            : { background: '#6b7280', color: '#ffffff' }
                        }
                      >
                        {item.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditTarget(item)} className="btn-secondary btn-sm">
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
                            await deleteItem(item.id);
                          }}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
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

interface FormData extends Partial<ShowcaseService> {
  title: string;
  description: string;
  icon: string;
}

function ServiceForm({
  existing,
  onSubmit,
  onCancel,
  isSaving,
  mode,
}: {
  existing?: ShowcaseService;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [pricing, setPricing] = useState(existing?.pricing ?? '');
  const [orderNum, setOrderNum] = useState(existing?.order ?? 0);
  const [featuresText, setFeaturesText] = useState((existing?.features ?? []).join('\n'));
  const [published, setPublished] = useState(existing?.published ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !icon.trim()) return;
    const features = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      icon: icon.trim(),
      features,
      pricing: pricing.trim() || null,
      order: orderNum,
      published,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? 'New Service' : `Edit ${existing?.title ?? ''}`}
        </h2>
        <button onClick={onCancel} className="text-iron-500 hover:text-iron-300 text-lg leading-none">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Title *</label>
          <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Description *</label>
          <textarea
            className="input w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Icon path *</label>
          <input
            className="input w-full font-mono text-xs"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            required
            placeholder="/images/services/3d-printing.png"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Pricing</label>
          <input className="input w-full" value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder='e.g. "From $50" or "Quote on request"' />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Sort order</label>
          <input
            type="number"
            className="input w-full"
            value={orderNum}
            onChange={(e) => setOrderNum(parseInt(e.target.value || '0', 10))}
            min={0}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Published</label>
          <button
            type="button"
            onClick={() => setPublished((v) => !v)}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={
              published
                ? { background: '#15803d', color: '#ffffff' }
                : { background: '#6b7280', color: '#ffffff' }
            }
          >
            {published ? 'Published' : 'Draft'}
          </button>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Features (one per line)</label>
          <textarea
            className="input w-full"
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            rows={4}
            placeholder={'High-detail printing\nMultiple material options\nFast turnaround'}
          />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !description.trim() || !icon.trim()}
            className="btn-primary btn-sm"
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Service' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

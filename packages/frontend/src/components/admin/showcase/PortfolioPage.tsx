import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useShowcasePortfolio } from '../../../hooks/useShowcasePortfolio';
import { PageIcon } from '../../common/PageIcon';
import type { ShowcasePortfolioItem } from '../../../services/api';

/**
 * Showcase → Portfolio admin (BuildPlan #11 Phase 3).
 *
 * Data + auth live in wiz3d-prints (existing PortfolioItem Prisma model
 * + /api/portfolio routes accepting X-Admin-Token). This page CRUDs via
 * the /api/showcase-portfolio backend proxy on this side. Customer site
 * at showcase.wiz3dprints.com/portfolio renders from the same DB on the
 * next request — no manual cache bust needed.
 *
 * Image fields are FILENAME strings (e.g. "boubin-1.png"). Wiz uploads
 * the actual files to /home/shad/docker/wiz3d_prints/data/images/portfolio/
 * on the host (Bug #51 cycle-fix bind mount). The dynamic image API on
 * wiz3d-prints serves them at /images/portfolio/<filename>.
 */
export function ShowcasePortfolioPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { items, isLoading, createItem, updateItem, deleteItem, isCreating, isUpdating } =
    useShowcasePortfolio();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ShowcasePortfolioItem | null>(null);

  if (!isAdmin) {
    return <div className="card text-center text-white">Admin access required.</div>;
  }

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/products.png" alt="Portfolio" />
            <h1 className="text-2xl font-bold text-iron-50">Showcase — Portfolio</h1>
          </div>
          {!showCreate && !editTarget && (
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
              + New Portfolio Item
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Public gallery on showcase.wiz3dprints.com/portfolio. Image filenames here
          must match files in <code className="text-xs">/home/shad/docker/wiz3d_prints/data/images/portfolio/</code> on the host.
        </p>
      </div>

      {showCreate && (
        <PortfolioForm
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
        <PortfolioForm
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
          No portfolio items yet. Click + New Portfolio Item to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Material</th>
                <th>Images</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-white">
                    {item.featured && <span className="mr-2" style={{ color: '#ff9900' }}>★</span>}
                    {item.title}
                  </td>
                  <td style={{ color: '#9ca3af' }}>{item.category}</td>
                  <td style={{ color: '#9ca3af' }}>{item.material}</td>
                  <td style={{ color: '#9ca3af' }}>{item.images.length}</td>
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

interface FormData extends Partial<ShowcasePortfolioItem> {
  title: string;
  description: string;
  category: string;
  material: string;
}

const CATEGORIES = ['Miniature', 'Decorative', 'Functional', 'Prototype', 'Custom'];

function PortfolioForm({
  existing,
  onSubmit,
  onCancel,
  isSaving,
  mode,
}: {
  existing?: ShowcasePortfolioItem;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? CATEGORIES[0]);
  const [material, setMaterial] = useState(existing?.material ?? 'PLA');
  const [dimensions, setDimensions] = useState(existing?.dimensions ?? '');
  const [printTime, setPrintTime] = useState(existing?.printTime ?? '');
  const [imagesText, setImagesText] = useState((existing?.images ?? []).join('\n'));
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [published, setPublished] = useState(existing?.published ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !category.trim() || !material.trim()) return;
    const images = imagesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith('/images/portfolio/') || s.startsWith('http') ? s : `/images/portfolio/${s}`));
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      material: material.trim(),
      dimensions: dimensions.trim() || null,
      printTime: printTime.trim() || null,
      images,
      featured,
      published,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? 'New Portfolio Item' : `Edit ${existing?.title ?? ''}`}
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
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Category *</label>
          <select className="input w-full" value={category} onChange={(e) => setCategory(e.target.value)} required>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Material *</label>
          <input className="input w-full" value={material} onChange={(e) => setMaterial(e.target.value)} required placeholder="e.g. PLA, PETG, ABS" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Dimensions</label>
          <input className="input w-full" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder='e.g. 3.75" L x 7.25" H x 3.5" W' />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Print Time</label>
          <input className="input w-full" value={printTime} onChange={(e) => setPrintTime(e.target.value)} placeholder="e.g. ~3 hours total" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Image Filenames (one per line)</label>
          <textarea
            className="input w-full font-mono text-xs"
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            rows={4}
            placeholder="boubin-1.png&#10;boubin-2.png"
          />
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
            Files must exist at <code>/home/shad/docker/wiz3d_prints/data/images/portfolio/&lt;filename&gt;</code> on the host.
            Bare filenames get the <code>/images/portfolio/</code> prefix automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Featured</label>
          <button
            type="button"
            onClick={() => setFeatured((v) => !v)}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={
              featured
                ? { background: '#ff9900', color: '#0a0a0a' }
                : { background: '#6b7280', color: '#ffffff' }
            }
          >
            {featured ? 'Featured' : 'Not featured'}
          </button>
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

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !description.trim()}
            className="btn-primary btn-sm"
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Item' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

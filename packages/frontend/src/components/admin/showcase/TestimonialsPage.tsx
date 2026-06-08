import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useShowcaseTestimonials } from '../../../hooks/useShowcaseTestimonials';
import { useShowcasePortfolio } from '../../../hooks/useShowcasePortfolio';
import { PageIcon } from '../../common/PageIcon';
import type { ShowcaseTestimonial } from '../../../services/api';

/**
 * Showcase → Testimonials admin (BuildPlan #11 Phase 6).
 *
 * Testimonials can link to a portfolio item via portfolioItemId.
 * Picker on the form uses the same portfolio list the Portfolio page
 * renders.
 */
export function ShowcaseTestimonialsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { items, isLoading, createItem, updateItem, deleteItem, isCreating, isUpdating } = useShowcaseTestimonials();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ShowcaseTestimonial | null>(null);

  if (!isAdmin) return <div className="card text-center text-white">Admin access required.</div>;

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/customers.png" alt="Testimonials" />
            <h1 className="text-2xl font-bold text-iron-50">Showcase — Testimonials</h1>
          </div>
          {!showCreate && !editTarget && (
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">+ New Testimonial</button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Customer testimonials on showcase.wiz3dprints.com/testimonials. Link to a portfolio item
          to surface the testimonial alongside that project.
        </p>
      </div>

      {showCreate && (
        <TestimonialForm
          onCancel={() => setShowCreate(false)}
          onSubmit={async (data) => { await createItem(data); setShowCreate(false); }}
          isSaving={isCreating}
          mode="create"
        />
      )}

      {editTarget && (
        <TestimonialForm
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
        <div className="card text-center" style={{ color: '#9ca3af' }}>No testimonials yet.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Rating</th>
                <th>Linked portfolio</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TestimonialRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditTarget(item)}
                  onTogglePublished={() => updateItem(item.id, { published: !item.published })}
                  onDelete={async () => { if (!confirm(`Delete testimonial from "${item.name}"?`)) return; await deleteItem(item.id); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TestimonialRow({
  item, onEdit, onTogglePublished, onDelete,
}: {
  item: ShowcaseTestimonial;
  onEdit: () => void;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const { items: portfolio } = useShowcasePortfolio();
  const linked = portfolio.find((p) => p.id === item.portfolioItemId);
  return (
    <tr>
      <td className="font-medium text-white">
        {item.featured && <span className="mr-2" style={{ color: '#ff9900' }}>★</span>}
        {item.name}
        {item.role && <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>· {item.role}</span>}
      </td>
      <td style={{ color: '#9ca3af' }}>{item.company || '—'}</td>
      <td className="font-mono" style={{ color: '#ff9900' }}>{'★'.repeat(item.rating)}</td>
      <td>
        {item.portfolioItemId == null ? (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#4b5563', color: '#ffffff' }}>unlinked</span>
        ) : linked ? (
          <span className="text-white">{linked.title}</span>
        ) : (
          <span className="text-xs font-mono" style={{ color: '#9ca3af' }}>#{item.portfolioItemId.slice(-8)} (missing)</span>
        )}
      </td>
      <td>
        <button
          onClick={onTogglePublished}
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={item.published ? { background: '#15803d', color: '#ffffff' } : { background: '#6b7280', color: '#ffffff' }}
        >
          {item.published ? 'Published' : 'Draft'}
        </button>
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button onClick={onEdit} className="btn-secondary btn-sm">Edit</button>
          <button onClick={onDelete} className="btn-danger btn-sm">Delete</button>
        </div>
      </td>
    </tr>
  );
}

interface TestimonialFormData extends Partial<ShowcaseTestimonial> {
  name: string;
  role: string;
  content: string;
}

function TestimonialForm({
  existing, onSubmit, onCancel, isSaving, mode,
}: {
  existing?: ShowcaseTestimonial;
  onSubmit: (data: TestimonialFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [company, setCompany] = useState(existing?.company ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [published, setPublished] = useState(existing?.published ?? true);
  const [portfolioItemId, setPortfolioItemId] = useState(existing?.portfolioItemId ?? null);

  const { items: portfolio } = useShowcasePortfolio();
  const [portfolioQuery, setPortfolioQuery] = useState('');
  const selectedPortfolio = useMemo(
    () => portfolio.find((p) => p.id === portfolioItemId),
    [portfolio, portfolioItemId],
  );
  const filteredPortfolio = useMemo(() => {
    const q = portfolioQuery.trim().toLowerCase();
    if (!q) return portfolio.slice(0, 8);
    return portfolio
      .filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8);
  }, [portfolio, portfolioQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !content.trim()) return;
    await onSubmit({
      name: name.trim(),
      role: role.trim(),
      company: company.trim() || null,
      content: content.trim(),
      rating,
      icon: icon.trim() || null,
      featured,
      published,
      portfolioItemId,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? 'New Testimonial' : `Edit ${existing?.name ?? ''}`}
        </h2>
        <button onClick={onCancel} className="text-iron-500 hover:text-iron-300 text-lg leading-none">×</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Name *</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Role *</label>
          <input className="input w-full" value={role} onChange={(e) => setRole(e.target.value)} required placeholder="e.g. Owner, Manager" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Company</label>
          <input className="input w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Rating (1-5)</label>
          <input type="number" min={1} max={5} className="input w-full" value={rating} onChange={(e) => setRating(Math.max(1, Math.min(5, parseInt(e.target.value || '5', 10))))} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Content *</label>
          <textarea className="input w-full" value={content} onChange={(e) => setContent(e.target.value)} rows={5} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Icon path</label>
          <input className="input w-full font-mono text-xs" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="/images/services/3d-printing.png" />
        </div>
        <div className="flex items-center gap-3 mt-6">
          <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Featured</label>
          <button type="button" onClick={() => setFeatured((v) => !v)} className="px-3 py-1 rounded-full text-xs font-semibold" style={featured ? { background: '#ff9900', color: '#0a0a0a' } : { background: '#6b7280', color: '#ffffff' }}>
            {featured ? 'Featured' : 'Not featured'}
          </button>
          <label className="text-sm font-medium ml-4" style={{ color: '#ff9900' }}>Published</label>
          <button type="button" onClick={() => setPublished((v) => !v)} className="px-3 py-1 rounded-full text-xs font-semibold" style={published ? { background: '#15803d', color: '#ffffff' } : { background: '#6b7280', color: '#ffffff' }}>
            {published ? 'Published' : 'Draft'}
          </button>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Linked portfolio item</label>
          {selectedPortfolio ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded" style={{ background: '#2d2d2d', color: '#e5e5e5' }}>
                {selectedPortfolio.title}
                <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>{selectedPortfolio.category}</span>
              </div>
              <button type="button" onClick={() => { setPortfolioItemId(null); setPortfolioQuery(''); }} className="btn-secondary btn-sm">Unlink</button>
            </div>
          ) : (
            <>
              <input className="input w-full" value={portfolioQuery} onChange={(e) => setPortfolioQuery(e.target.value)} placeholder="Type portfolio item title…" />
              {filteredPortfolio.length > 0 && (
                <div className="mt-2 rounded border max-h-48 overflow-y-auto" style={{ background: '#1a1a1a', borderColor: '#2d2d2d' }}>
                  {filteredPortfolio.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPortfolioItemId(p.id); setPortfolioQuery(''); }}
                      className="block w-full text-left px-3 py-2 hover:bg-iron-800"
                      style={{ color: '#e5e5e5' }}
                    >
                      <div className="text-sm font-medium">{p.title}</div>
                      <div className="text-xs" style={{ color: '#9ca3af' }}>{p.category}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSaving || !name.trim() || !role.trim() || !content.trim()} className="btn-primary btn-sm">
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Testimonial' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

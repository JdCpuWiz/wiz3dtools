import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useShowcaseAbout } from '../../../hooks/useShowcaseAbout';
import { PageIcon } from '../../common/PageIcon';
import type { AboutBlockKind, ShowcaseAboutBlock } from '../../../services/api';

/**
 * Showcase → About admin (BuildPlan #11 Phase 7).
 *
 * About blocks are polymorphic — three `kind`s with distinct data
 * shapes (stat / equipment / value). Tabs filter by kind; the form
 * renders different fields per kind. See wiz3d-prints schema.prisma
 * for the canonical contract.
 */

const KIND_LABELS: Record<AboutBlockKind, { plural: string; singular: string; desc: string }> = {
  stat: {
    plural: 'Stats',
    singular: 'Stat',
    desc: 'Headline numbers (e.g. "500+ Projects Completed"). Currently unused on the public page but available for future hero/banner placement.',
  },
  equipment: {
    plural: 'Equipment',
    singular: 'Equipment Card',
    desc: 'Capability cards in the "Our Equipment" section — name, type tagline, bullet list of capabilities.',
  },
  value: {
    plural: 'Values',
    singular: 'Value',
    desc: 'Pillars in the "What Drives Us" section — title, description, and one of four built-in icons.',
  },
};

const VALUE_ICONS: { id: string; label: string }[] = [
  { id: 'badge', label: 'Badge (quality)' },
  { id: 'users', label: 'Users (people)' },
  { id: 'lightbulb', label: 'Lightbulb (innovation)' },
  { id: 'shield', label: 'Shield (reliability)' },
];

export function ShowcaseAboutPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { items, isLoading, createItem, updateItem, deleteItem, isCreating, isUpdating } = useShowcaseAbout();
  const [activeKind, setActiveKind] = useState<AboutBlockKind>('value');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ShowcaseAboutBlock | null>(null);

  const visible = useMemo(
    () => items.filter((b) => b.kind === activeKind).sort((a, b) => a.sortOrder - b.sortOrder),
    [items, activeKind],
  );

  if (!isAdmin) return <div className="card text-center text-white">Admin access required.</div>;

  const meta = KIND_LABELS[activeKind];

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/customers.png" alt="About" />
            <h1 className="text-2xl font-bold text-iron-50">Showcase — About</h1>
          </div>
          {!showCreate && !editTarget && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary btn-sm"
            >+ New {meta.singular}</button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Blocks on wiz3dprints.com/about. Three content kinds, each rendered in a different
          section of the page. Edits go live within ~5 minutes (ISR cache).
        </p>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(KIND_LABELS) as AboutBlockKind[]).map((k) => {
          const count = items.filter((b) => b.kind === k).length;
          const active = k === activeKind;
          return (
            <button
              key={k}
              onClick={() => { setActiveKind(k); setShowCreate(false); setEditTarget(null); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={active
                ? { background: '#ff9900', color: '#0a0a0a' }
                : { background: '#4b5563', color: '#ffffff' }}
            >
              {KIND_LABELS[k].plural} <span className="ml-1 text-xs opacity-80">({count})</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>{meta.desc}</p>

      {showCreate && (
        <AboutForm
          kind={activeKind}
          onCancel={() => setShowCreate(false)}
          onSubmit={async (input) => { await createItem(input); setShowCreate(false); }}
          isSaving={isCreating}
          mode="create"
          existingCount={visible.length}
        />
      )}

      {editTarget && (
        <AboutForm
          kind={editTarget.kind}
          existing={editTarget}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (input) => { await updateItem(editTarget.id, input); setEditTarget(null); }}
          isSaving={isUpdating}
          mode="edit"
        />
      )}

      {isLoading ? (
        <div className="card text-center text-white">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="card text-center" style={{ color: '#9ca3af' }}>No {meta.plural.toLowerCase()} yet.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Sort</th>
                <th>Content</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <AboutRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditTarget(item)}
                  onTogglePublished={() => updateItem(item.id, { published: !item.published })}
                  onDelete={async () => {
                    if (!confirm(`Delete this ${KIND_LABELS[item.kind].singular.toLowerCase()}?`)) return;
                    await deleteItem(item.id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AboutRow({
  item, onEdit, onTogglePublished, onDelete,
}: {
  item: ShowcaseAboutBlock;
  onEdit: () => void;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="font-mono text-xs" style={{ color: '#9ca3af' }}>{item.sortOrder}</td>
      <td className="text-white">
        <AboutSummary kind={item.kind} data={item.data} />
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

function AboutSummary({ kind, data }: { kind: AboutBlockKind; data: Record<string, unknown> }) {
  if (kind === 'stat') {
    return (
      <span>
        <span style={{ color: '#ff9900', fontWeight: 600 }}>{String(data.value ?? '—')}</span>
        <span className="ml-2" style={{ color: '#9ca3af' }}>{String(data.label ?? '')}</span>
      </span>
    );
  }
  if (kind === 'equipment') {
    const caps = Array.isArray(data.capabilities) ? (data.capabilities as string[]) : [];
    return (
      <span>
        <span style={{ fontWeight: 600 }}>{String(data.name ?? '—')}</span>
        <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>· {String(data.type ?? '')}</span>
        <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>({caps.length} cap{caps.length === 1 ? '' : 's'})</span>
      </span>
    );
  }
  // value
  return (
    <span>
      <span style={{ fontWeight: 600 }}>{String(data.title ?? '—')}</span>
      <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>icon: {String(data.icon ?? 'badge')}</span>
    </span>
  );
}

function AboutForm({
  kind, existing, onSubmit, onCancel, isSaving, mode, existingCount,
}: {
  kind: AboutBlockKind;
  existing?: ShowcaseAboutBlock;
  onSubmit: (input: Partial<ShowcaseAboutBlock>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
  existingCount?: number;
}) {
  const initialData = (existing?.data ?? {}) as Record<string, unknown>;
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder ?? existingCount ?? 0);
  const [published, setPublished] = useState(existing?.published ?? true);

  // Per-kind state
  const [statValue, setStatValue] = useState(String(initialData.value ?? ''));
  const [statLabel, setStatLabel] = useState(String(initialData.label ?? ''));

  const [eqName, setEqName] = useState(String(initialData.name ?? ''));
  const [eqType, setEqType] = useState(String(initialData.type ?? ''));
  const [eqCaps, setEqCaps] = useState<string>(
    Array.isArray(initialData.capabilities) ? (initialData.capabilities as string[]).join('\n') : '',
  );

  const [valTitle, setValTitle] = useState(String(initialData.title ?? ''));
  const [valDescription, setValDescription] = useState(String(initialData.description ?? ''));
  const [valIcon, setValIcon] = useState(String(initialData.icon ?? 'badge'));

  const meta = KIND_LABELS[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let data: Record<string, unknown>;
    if (kind === 'stat') {
      if (!statValue.trim() || !statLabel.trim()) return;
      data = { value: statValue.trim(), label: statLabel.trim() };
    } else if (kind === 'equipment') {
      if (!eqName.trim() || !eqType.trim()) return;
      data = {
        name: eqName.trim(),
        type: eqType.trim(),
        capabilities: eqCaps.split('\n').map((s) => s.trim()).filter(Boolean),
      };
    } else {
      if (!valTitle.trim() || !valDescription.trim()) return;
      data = { title: valTitle.trim(), description: valDescription.trim(), icon: valIcon };
    }
    await onSubmit({
      ...(mode === 'create' && { kind }),
      data,
      sortOrder,
      published,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? `New ${meta.singular}` : `Edit ${meta.singular}`}
        </h2>
        <button onClick={onCancel} className="text-iron-500 hover:text-iron-300 text-lg leading-none">×</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kind === 'stat' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Value *</label>
              <input className="input w-full" value={statValue} onChange={(e) => setStatValue(e.target.value)} required autoFocus placeholder='e.g. "500+"' />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Label *</label>
              <input className="input w-full" value={statLabel} onChange={(e) => setStatLabel(e.target.value)} required placeholder='e.g. "Projects Completed"' />
            </div>
          </>
        )}

        {kind === 'equipment' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Name *</label>
              <input className="input w-full" value={eqName} onChange={(e) => setEqName(e.target.value)} required autoFocus placeholder='e.g. "FDM Printers"' />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Type / tagline *</label>
              <input className="input w-full" value={eqType} onChange={(e) => setEqType(e.target.value)} required placeholder='e.g. "Fused Deposition Modeling"' />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Capabilities (one per line)</label>
              <textarea
                className="input w-full font-mono text-xs"
                value={eqCaps}
                onChange={(e) => setEqCaps(e.target.value)}
                rows={6}
                placeholder={'Large build volume up to 256x256x256mm\nMultiple material support\nHigh-speed printing'}
              />
            </div>
          </>
        )}

        {kind === 'value' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Title *</label>
              <input className="input w-full" value={valTitle} onChange={(e) => setValTitle(e.target.value)} required autoFocus placeholder='e.g. "Quality First"' />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Icon</label>
              <select className="input w-full" value={valIcon} onChange={(e) => setValIcon(e.target.value)}>
                {VALUE_ICONS.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Description *</label>
              <textarea className="input w-full" value={valDescription} onChange={(e) => setValDescription(e.target.value)} rows={4} required />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Sort order</label>
          <input
            type="number"
            className="input w-full"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="flex items-center gap-3 mt-6">
          <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Status</label>
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
          <button type="submit" disabled={isSaving} className="btn-primary btn-sm">
            {isSaving ? 'Saving…' : mode === 'create' ? `Create ${meta.singular}` : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

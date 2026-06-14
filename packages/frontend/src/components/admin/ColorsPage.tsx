import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useColors } from '../../hooks/useColors';
import { useManufacturers } from '../../hooks/useManufacturers';
import { PageIcon } from '../common/PageIcon';
import { colorApi } from '../../services/api';
import type { ColorDuplicateGroup, ColorDuplicateRow } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { Color } from '@wizqueue/shared';

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

function AddColorForm({ onDone }: { onDone: () => void }) {
  const { create, isCreating } = useColors();
  const { manufacturers } = useManufacturers();
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#ff9900');
  const [manufacturerId, setManufacturerId] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await create({
      name: name.trim(),
      hex,
      manufacturerId: manufacturerId ? parseInt(manufacturerId) : null,
    });
    setName('');
    setHex('#ff9900');
    setManufacturerId('');
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold" style={{ color: '#ff9900' }}>Add Color</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Color Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Galaxy Black, Fire Red…"
            className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={inputSt}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Hex Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="w-10 h-9 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder="#ff9900"
              className="w-28 px-3 py-2 rounded-lg text-iron-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={inputSt}
            />
          </div>
        </div>
        {manufacturers.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Manufacturer</label>
            <select
              value={manufacturerId}
              onChange={(e) => setManufacturerId(e.target.value)}
              className="px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={inputSt}
            >
              <option value="">— None —</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={!name.trim() || isCreating} className="btn-primary btn-sm">
            {isCreating ? 'Adding…' : 'Add Color'}
          </button>
          <button type="button" onClick={onDone} className="btn-secondary btn-sm">Cancel</button>
        </div>
      </div>
    </form>
  );
}

function ColorRow({ color, index }: { color: Color; index: number }) {
  const { update, delete: deleteColor } = useColors();
  const { manufacturers } = useManufacturers();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);
  const [manufacturerId, setManufacturerId] = useState<string>(color.manufacturerId ? String(color.manufacturerId) : '');
  const [inventoryGrams, setInventoryGrams] = useState(color.inventoryGrams.toFixed(1));
  const [addingGrams, setAddingGrams] = useState(false);
  const [spoolGrams, setSpoolGrams] = useState('');

  const openAddSpool = () => {
    setSpoolGrams(String(color.manufacturer?.fullSpoolNetWeightG ?? 1000));
    setAddingGrams(true);
  };

  const handleAddSpool = async () => {
    const g = parseFloat(spoolGrams);
    if (isNaN(g) || g <= 0) return;
    await update(color.id, { inventoryGrams: color.inventoryGrams + g });
    setAddingGrams(false);
  };

  const save = async () => {
    const parsedGrams = parseFloat(inventoryGrams);
    await update(color.id, {
      name: name.trim(),
      hex,
      manufacturerId: manufacturerId ? parseInt(manufacturerId) : null,
      inventoryGrams: isNaN(parsedGrams) ? color.inventoryGrams : parsedGrams,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${color.name}"? It will be removed from any existing invoices.`)) return;
    deleteColor(color.id);
  };

  if (editing) {
    return (
      <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
            <input value={hex} onChange={(e) => setHex(e.target.value)} className="w-24 px-2 py-1 rounded text-iron-50 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </div>
        </td>
        <td className="px-4 py-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
        </td>
        <td className="px-4 py-2">
          <select
            value={manufacturerId}
            onChange={(e) => setManufacturerId(e.target.value)}
            className="px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            style={inputSt}
          >
            <option value="">— None —</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.1"
              value={inventoryGrams}
              onChange={(e) => setInventoryGrams(e.target.value)}
              className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
              style={inputSt}
            />
            <span className="text-xs text-white">g</span>
          </div>
        </td>
        <td className="px-4 py-2 text-sm text-white">{color.active ? 'Active' : 'Inactive'}</td>
        <td className="px-4 py-2">
          <div className="flex gap-1.5">
            <button onClick={save} className="btn-primary btn-sm text-xs">Save</button>
            <button onClick={() => { setName(color.name); setHex(color.hex); setInventoryGrams(color.inventoryGrams.toFixed(1)); setEditing(false); }} className="btn-secondary btn-sm text-xs">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  const rowBg = index % 2 === 0 ? '#181818' : '#232323';

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d', background: rowBg }} className="transition-colors hover:bg-iron-800/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: color.hex,
              border: `2px solid ${color.hex}`,
              flexShrink: 0,
            }}
          />
          <span className="font-mono text-xs text-white">{color.hex}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-white">{color.name}</td>
      <td className="px-4 py-3 text-xs text-white">{color.manufacturer?.name ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-4 flex-wrap">
          <span className="text-sm text-white text-right">{color.inventoryGrams.toFixed(0)}g</span>
          {addingGrams ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                step="1"
                value={spoolGrams}
                onChange={(e) => setSpoolGrams(e.target.value)}
                autoFocus
                className="w-16 px-1.5 py-0.5 rounded text-iron-50 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                style={inputSt}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSpool(); if (e.key === 'Escape') setAddingGrams(false); }}
              />
              <span className="text-xs text-white">g</span>
              <button onClick={handleAddSpool} className="btn-primary btn-sm text-xs">Add</button>
              <button onClick={() => setAddingGrams(false)} className="btn-secondary btn-sm text-xs">✕</button>
            </div>
          ) : (
            <button
              onClick={openAddSpool}
              className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
              style={{ background: '#ff9900', color: '#0a0a0a' }}
              title="Add spool — enter weight to add"
            >
              + Spool
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => update(color.id, { active: !color.active })}
          className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
          style={
            color.active
              ? { background: '#15803d', color: '#ffffff' }
              : { background: '#6b7280', color: '#ffffff' }
          }
        >
          {color.active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm text-xs">Edit</button>
          <button onClick={handleDelete} className="btn-danger btn-sm text-xs">Delete</button>
        </div>
      </td>
    </tr>
  );
}

export const ColorsPage: React.FC = () => {
  const { colors, isLoading } = useColors();
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('bambuddy-last-sync') : null),
  );
  const [dedupeOpen, setDedupeOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await colorApi.syncFromBambuddy();
      const c = result.catalog;
      const i = result.inventory;
      const ts = new Date(result.finishedAt).toLocaleString();
      localStorage.setItem('bambuddy-last-sync', ts);
      setLastSync(ts);
      const mfgWarn = c.manufacturerUnmatched > 0
        ? ` · ${c.manufacturerUnmatched} need manufacturer`
        : '';
      toast.success(
        `Catalog: +${c.added} added, ${c.updated} updated, ${c.untouched} unchanged${mfgWarn}. ` +
        `Inventory: ${i.colorsUpdated} colors refreshed (${(i.totalGrams / 1000).toFixed(2)} kg total).`,
        { duration: 8000 },
      );
      queryClient.invalidateQueries({ queryKey: ['colors'] });
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/filament-color-administration.png" alt="Colors" />
            <div>
              <h2 className="text-xl font-semibold text-iron-50">Color Catalog</h2>
              <p className="text-sm text-white mt-0.5">
                Manage print colors, manufacturers, and inventory
                {lastSync && <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>· Last BamBuddy sync: {lastSync}</span>}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDedupeOpen(true)}
            className="btn-secondary btn-sm"
            title="Scan for colors that share the same hex + material. Bug #66."
          >
            Find Duplicates
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary btn-sm"
            title="Pull BamBuddy's filament catalog + per-color inventory. New colors arrive inactive."
          >
            {syncing ? 'Syncing…' : '⟳ Sync from BamBuddy'}
          </button>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ Add Color</button>
          )}
        </div>
      </div>

      {showAdd && <AddColorForm onDone={() => setShowAdd(false)} />}

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold w-40" style={{ color: '#ff9900' }}>Swatch</th>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: '#ff9900' }}>Name</th>
              <th className="text-left px-4 py-2.5 font-semibold w-32" style={{ color: '#ff9900' }}>Manufacturer</th>
              <th className="text-right px-4 py-2.5 font-semibold w-40" style={{ color: '#ff9900' }}>Inventory</th>
              <th className="text-left px-4 py-2.5 font-semibold w-24" style={{ color: '#ff9900' }}>Status</th>
              <th className="px-4 py-2.5 w-32" />
            </tr>
          </thead>
          <tbody>
            {colors.map((c, i) => <ColorRow key={c.id} color={c} index={i} />)}
            {colors.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white text-sm">No colors yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dedupeOpen && (
        <DedupeModal
          onClose={() => setDedupeOpen(false)}
          onMerged={() => queryClient.invalidateQueries({ queryKey: ['colors'] })}
        />
      )}
    </div>
  );
};

// Bug #66 — Find Duplicates modal. Lists every (hex, material) group with
// >1 color row, lets admin pick a keeper per group + run a transactional
// merge. Defaults the keeper to the row already linked to BamBuddy
// (bambuddy_id IS NOT NULL) because deleting a BB-linked row would just
// have the next sync re-insert it.
function DedupeModal({
  onClose,
  onMerged,
}: {
  onClose: () => void;
  onMerged: () => void;
}) {
  const [groups, setGroups] = useState<ColorDuplicateGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [keepers, setKeepers] = useState<Record<string, number>>({}); // groupKey → keepId
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const g = await colorApi.findDuplicates();
      setGroups(g);
      // Default each group's keeper to the linked row if any; else lowest id.
      const next: Record<string, number> = {};
      for (const grp of g) {
        const key = `${grp.hex}|${grp.material ?? '∅'}`;
        const linked = grp.rows.find((r) => r.bambuddyId !== null);
        next[key] = linked ? linked.id : grp.rows[0].id;
      }
      setKeepers(next);
    } catch (err: any) {
      toast.error(`Failed to load duplicates: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const handleMerge = async (group: ColorDuplicateGroup) => {
    const key = `${group.hex}|${group.material ?? '∅'}`;
    const keepId = keepers[key];
    if (!keepId) return;
    const mergeIds = group.rows.filter((r) => r.id !== keepId).map((r) => r.id);
    if (mergeIds.length === 0) return;
    if (!confirm(
      `Merge ${mergeIds.length} duplicate(s) of ${group.hex}${group.material ? ` ${group.material}` : ''} into color #${keepId}?\n\n` +
      `Invoice references will be repointed and the dupe row(s) deleted. This cannot be undone (but won't change any invoice colors visually).`
    )) return;
    setBusyKey(key);
    try {
      const result = await colorApi.mergeDuplicates(keepId, mergeIds);
      toast.success(
        `Merged ${result.merged} into #${keepId}. ` +
        `${result.lineItemColorsRepointed} invoice color(s), ${result.productColorsRepointed} product slot(s) repointed; ${result.productColorsMerged} overlapping product slot(s) merged.`,
        { duration: 6000 },
      );
      onMerged();
      await refresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || String(err);
      toast.error(`Merge failed: ${msg}`, { duration: 8000 });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="card max-w-5xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#ff9900' }}>
            Duplicate Colors
          </h3>
          <button onClick={onClose} className="btn-secondary btn-sm">Close</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="text-sm text-iron-100 py-6 text-center">
            No duplicates found — every color in the catalog is unique by hex + material.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-white/60">
              Each group shares the same hex + material. Pick a keeper, hit Merge.
              The keeper defaults to the row already linked to BamBuddy
              (only one row per BB color can survive a sync).
            </p>
            {groups.map((group) => {
              const key = `${group.hex}|${group.material ?? '∅'}`;
              const isBusy = busyKey === key;
              return (
                <div
                  key={key}
                  className="rounded-lg p-3 space-y-2"
                  style={{ background: '#1a1a1a', border: '1px solid #2d2d2d' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-5 h-5 rounded"
                      style={{ background: group.hex, border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                    <span className="font-mono text-xs text-white">{group.hex}</span>
                    {group.material && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#2d2d2d', color: '#d1d5db' }}>
                        {group.material}
                      </span>
                    )}
                    <span className="text-xs text-white/50">· {group.count} rows</span>
                    <button
                      className="ml-auto btn-primary btn-sm"
                      onClick={() => handleMerge(group)}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Merging…' : `Merge → keep #${keepers[key]}`}
                    </button>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left" style={{ color: '#ff9900' }}>
                        <th className="py-1 pr-2">Keep</th>
                        <th className="py-1 pr-2">#ID</th>
                        <th className="py-1 pr-2">Name</th>
                        <th className="py-1 pr-2">Mfr</th>
                        <th className="py-1 pr-2">BB</th>
                        <th className="py-1 pr-2">Active</th>
                        <th className="py-1 pr-2 text-right">Inv (g)</th>
                        <th className="py-1 pr-2 text-right">Invoices</th>
                        <th className="py-1 pr-2 text-right">Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <DedupeRow
                          key={row.id}
                          row={row}
                          isKeeper={keepers[key] === row.id}
                          onPick={() => setKeepers((p) => ({ ...p, [key]: row.id }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DedupeRow({
  row,
  isKeeper,
  onPick,
}: {
  row: ColorDuplicateRow;
  isKeeper: boolean;
  onPick: () => void;
}) {
  const linked = row.bambuddyId !== null;
  return (
    <tr
      style={{
        background: isKeeper ? 'rgba(255, 153, 0, 0.08)' : 'transparent',
      }}
    >
      <td className="py-1 pr-2">
        <input
          type="radio"
          name={`keeper-${row.hex}-${row.material ?? 'null'}`}
          checked={isKeeper}
          onChange={onPick}
          aria-label={`Keep color #${row.id}`}
        />
      </td>
      <td className="py-1 pr-2 font-mono text-white">#{row.id}</td>
      <td className="py-1 pr-2 text-white">{row.name}</td>
      <td className="py-1 pr-2 text-white/70">{row.manufacturerName ?? '—'}</td>
      <td className="py-1 pr-2">
        {linked ? (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: '#15803d', color: '#ffffff' }}
            title={`Linked to BamBuddy color ${row.bambuddyId}`}
          >
            BB:{row.bambuddyId}
          </span>
        ) : (
          <span className="text-white/40 text-[10px]">unlinked</span>
        )}
      </td>
      <td className="py-1 pr-2">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={row.active
            ? { background: '#15803d', color: '#ffffff' }
            : { background: '#6b7280', color: '#ffffff' }
          }
        >
          {row.active ? 'Active' : 'Off'}
        </span>
      </td>
      <td className="py-1 pr-2 text-right font-mono text-white">{row.inventoryGrams.toFixed(0)}</td>
      <td className="py-1 pr-2 text-right font-mono text-white">{row.lineItemRefs}</td>
      <td className="py-1 pr-2 text-right font-mono text-white">{row.productRefs}</td>
    </tr>
  );
}

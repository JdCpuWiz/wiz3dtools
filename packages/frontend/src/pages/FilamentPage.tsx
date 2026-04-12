import React, { useState } from 'react';
import { useColors } from '../hooks/useColors';
import { useManufacturers } from '../hooks/useManufacturers';
import { useAuth } from '../context/AuthContext';
import { PageIcon } from '../components/common/PageIcon';
import type { Color, Manufacturer } from '@wizqueue/shared';

function filamentGrams(color: Color): number {
  return color.inventoryGrams - (color.manufacturer?.emptySpoolWeightG ?? 0);
}

function stockStatus(color: Color): 'critical' | 'low' | 'ok' | 'empty' {
  const net = filamentGrams(color);
  const critical = color.manufacturer?.criticalThresholdG ?? 200;
  const low = color.manufacturer?.lowThresholdG ?? 500;
  if (net <= 0) return 'empty';
  if (net <= critical) return 'critical';
  if (net <= low) return 'low';
  return 'ok';
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ok:       { label: 'OK',       color: '#ffffff', bg: '#15803d' },
  low:      { label: 'Low',      color: '#000000', bg: '#eab308' },
  critical: { label: 'Critical', color: '#ffffff', bg: '#b91c1c' },
  empty:    { label: 'Empty',    color: '#ffffff', bg: '#4b5563' },
};

function ColorInventoryRow({ color, isAdmin, index }: { color: Color; isAdmin: boolean; index: number }) {
  const { update } = useColors();
  const [editing, setEditing] = useState(false);
  const netGrams = filamentGrams(color);
  const [manualGrams, setManualGrams] = useState(String(color.inventoryGrams.toFixed(0)));
  const [addingGrams, setAddingGrams] = useState(false);
  const [spoolGrams, setSpoolGrams] = useState('');
  const status = stockStatus(color);
  const style = STATUS_STYLE[status];
  const disabled = !color.active;

  const handleSaveManual = async () => {
    const grams = parseFloat(manualGrams);
    if (isNaN(grams)) return;
    await update(color.id, { inventoryGrams: grams });
    setEditing(false);
  };

  const openAddSpool = () => {
    const gross = (color.manufacturer?.fullSpoolNetWeightG ?? 1000) + (color.manufacturer?.emptySpoolWeightG ?? 0);
    setSpoolGrams(String(gross));
    setAddingGrams(true);
  };

  const handleAddSpool = async () => {
    const g = parseFloat(spoolGrams);
    if (isNaN(g) || g <= 0) return;
    await update(color.id, { inventoryGrams: color.inventoryGrams + g });
    setAddingGrams(false);
  };

  const pct = color.manufacturer
    ? Math.min(100, Math.max(0, Math.round((filamentGrams(color) / color.manufacturer.fullSpoolNetWeightG) * 100)))
    : null;

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d', opacity: disabled ? 0.45 : 1, background: index % 2 === 0 ? '#181818' : '#232323' }} className="hover:bg-iron-800/10 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: color.hex,
              border: `2px solid ${color.hex}`,
              flexShrink: 0,
            }}
          />
          <div>
            <div className="text-sm font-medium text-white">{color.name}</div>
            <div className="text-xs text-white font-mono">{color.hex}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-white">
        {color.manufacturer?.name ?? '—'}
      </td>
      <td className="px-4 py-3">
        {editing && isAdmin ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={manualGrams}
              onChange={(e) => setManualGrams(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveManual(); if (e.key === 'Escape') { setEditing(false); setManualGrams(String(color.inventoryGrams.toFixed(0))); } }}
              className="w-24 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              style={inputSt}
            />
            <span className="text-xs text-white">g</span>
            <button onClick={handleSaveManual} className="btn-primary btn-sm text-xs">Save</button>
            <button onClick={() => { setEditing(false); setManualGrams(String(color.inventoryGrams.toFixed(0))); }} className="btn-secondary btn-sm text-xs">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: disabled ? '#6b7280' : status === 'ok' ? '#ffffff' : style.color }}>
              {Math.max(0, netGrams).toFixed(0)}g
            </span>
            {isAdmin && !disabled && (
              <button
                onClick={() => { setManualGrams(String(color.inventoryGrams.toFixed(1))); setEditing(true); }}
                className="text-white hover:text-white transition-colors"
                title="Set inventory amount"
                style={{ fontSize: 12, lineHeight: 1 }}
              >
                ✎
              </button>
            )}
            {pct !== null && !disabled && (
              <div className="flex-1 min-w-16 max-w-24 h-1.5 rounded-full overflow-hidden" style={{ background: '#2d2d2d' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, pct)}%`,
                    background: status === 'ok' ? '#4ade80' : status === 'low' ? '#fb923c' : status === 'critical' ? '#ef4444' : '#4b5563',
                  }}
                />
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {disabled ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: '#ffffff', background: '#6b7280' }}>
            Disabled
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: style.color, background: style.bg }}>
            {style.label}
          </span>
        )}
      </td>
      {isAdmin && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {!disabled && (
              addingGrams ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={spoolGrams}
                    onChange={(e) => setSpoolGrams(e.target.value)}
                    autoFocus
                    className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                    style={inputSt}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSpool(); if (e.key === 'Escape') setAddingGrams(false); }}
                  />
                  <span className="text-xs text-white">g</span>
                  <button onClick={handleAddSpool} className="btn-primary btn-sm text-xs">Add</button>
                  <button onClick={() => setAddingGrams(false)} className="btn-secondary btn-sm text-xs">✕</button>
                </div>
              ) : (
                <button onClick={openAddSpool} className="btn-secondary btn-sm text-xs whitespace-nowrap" title="Add spool">+ Spool</button>
              )
            )}
            <button
              onClick={() => update(color.id, { active: !color.active })}
              className="btn-secondary btn-sm text-xs whitespace-nowrap"
            >
              {disabled ? 'Enable' : 'Disable'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

function AddColorForm({ existingColors, onDone }: { existingColors: Color[]; onDone: () => void }) {
  const { create, isCreating } = useColors();
  const { manufacturers } = useManufacturers();
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#ff9900');
  const [manufacturerId, setManufacturerId] = useState('');
  const [initGrams, setInitGrams] = useState('0');
  const [dupWarning, setDupWarning] = useState('');

  const handleMfgChange = (mfgId: string) => {
    setManufacturerId(mfgId);
    setDupWarning('');
    if (mfgId) {
      const mfg = manufacturers.find((m: Manufacturer) => m.id === parseInt(mfgId));
      if (mfg) setInitGrams(String(mfg.fullSpoolNetWeightG + mfg.emptySpoolWeightG));
    } else {
      setInitGrams('0');
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setDupWarning('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Duplicate check: same name + same manufacturer
    const mfgId = manufacturerId ? parseInt(manufacturerId) : null;
    const dup = existingColors.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() && (c.manufacturerId ?? null) === mfgId,
    );
    if (dup) {
      setDupWarning(`"${dup.name}" already exists${dup.manufacturer ? ` for ${dup.manufacturer.name}` : ''}.`);
      return;
    }

    const grams = parseFloat(initGrams) || 0;
    await create({ name: name.trim(), hex, manufacturerId: mfgId, inventoryGrams: grams });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold" style={{ color: '#ff9900' }}>Add New Color</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Color Name</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
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
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Manufacturer</label>
          <select
            value={manufacturerId}
            onChange={(e) => handleMfgChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={inputSt}
          >
            <option value="">— None —</option>
            {manufacturers.map((m: Manufacturer) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>Initial Inventory (g)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={initGrams}
            onChange={(e) => setInitGrams(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={inputSt}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isCreating} className="btn-primary btn-sm">
            {isCreating ? 'Adding…' : 'Add Color'}
          </button>
          <button type="button" onClick={onDone} className="btn-secondary btn-sm">Cancel</button>
        </div>
      </div>
      {dupWarning && (
        <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>⚠ {dupWarning}</p>
      )}
    </form>
  );
}

export const FilamentPage: React.FC = () => {
  const { colors, isLoading } = useColors();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [filter, setFilter] = useState<'all' | 'low' | 'critical'>('all');
  const [showAddColor, setShowAddColor] = useState(false);

  const activeColors = colors.filter((c) => c.active);

  const filtered = filter === 'all'
    ? colors  // show all including disabled
    : activeColors.filter((c) => {
        const s = stockStatus(c);
        if (filter === 'critical') return s === 'critical' || s === 'empty';
        if (filter === 'low') return s === 'low';
        return true;
      });

  const criticalCount = activeColors.filter((c) => { const s = stockStatus(c); return s === 'critical' || s === 'empty'; }).length;
  const lowCount = activeColors.filter((c) => stockStatus(c) === 'low').length;
  const totalGrams = activeColors.reduce((s, c) => s + Math.max(0, filamentGrams(c)), 0);
  const disabledCount = colors.length - activeColors.length;

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <PageIcon src="/icons/filament-inventory.png" alt="Filament Inventory" />
          <div>
            <h1 className="text-2xl font-bold text-iron-50">Filament Inventory</h1>
            <p className="text-sm text-white mt-0.5">
              {totalGrams.toFixed(0)}g total · {activeColors.length} active{disabledCount > 0 ? `, ${disabledCount} disabled` : ''}
            </p>
          </div>
        </div>
        {isAdmin && !showAddColor && (
          <button onClick={() => setShowAddColor(true)} className="btn-primary btn-sm">+ New Color</button>
        )}
      </div>

      {showAddColor && isAdmin && (
        <AddColorForm existingColors={colors} onDone={() => setShowAddColor(false)} />
      )}

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={filter === 'all' ? { background: '#ff9900', color: '#0a0a0a' } : { background: '#2d2d2d', color: '#ffffff' }}
        >
          All ({colors.length})
        </button>
        {lowCount > 0 && (
          <button
            onClick={() => setFilter('low')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={filter === 'low' ? { background: '#eab308', color: '#000000' } : { background: '#2d2d2d', color: '#ffffff' }}
          >
            Low ({lowCount})
          </button>
        )}
        {criticalCount > 0 && (
          <button
            onClick={() => setFilter('critical')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={filter === 'critical' ? { background: '#b91c1c', color: '#ffffff' } : { background: '#2d2d2d', color: '#ffffff' }}
          >
            Critical ({criticalCount})
          </button>
        )}
      </div>

      <div className="card-surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: '#ff9900' }}>Color</th>
              <th className="text-left px-4 py-2.5 font-semibold w-36" style={{ color: '#ff9900' }}>Manufacturer</th>
              <th className="text-left px-4 py-2.5 font-semibold w-52" style={{ color: '#ff9900' }}>Inventory</th>
              <th className="text-left px-4 py-2.5 font-semibold w-28" style={{ color: '#ff9900' }}>Status</th>
              {isAdmin && <th className="px-4 py-2.5 w-48" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <ColorInventoryRow key={c.id} color={c} isAdmin={isAdmin} index={i} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-white text-sm">
                  {filter === 'all' ? 'No colors yet' : 'No colors in this category'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

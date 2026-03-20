import React, { useState } from 'react';
import { useColors } from '../hooks/useColors';
import { useAuth } from '../context/AuthContext';
import type { Color } from '@wizqueue/shared';

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
  ok:       { label: 'OK',       color: '#86efac', bg: '#14532d' },
  low:      { label: 'Low',      color: '#fdba74', bg: '#422006' },
  critical: { label: 'Critical', color: '#fca5a5', bg: '#450a0a' },
  empty:    { label: 'Empty',    color: '#9ca3af', bg: '#2d2d2d' },
};

function ColorInventoryRow({ color, isAdmin }: { color: Color; isAdmin: boolean }) {
  const { update } = useColors();
  const [editing, setEditing] = useState(false);
  const netGrams = filamentGrams(color);
  const [manualGrams, setManualGrams] = useState(String(color.inventoryGrams.toFixed(0)));
  const [addingGrams, setAddingGrams] = useState(false);
  const [spoolGrams, setSpoolGrams] = useState('');
  const status = stockStatus(color);
  const style = STATUS_STYLE[status];

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

  const inputSt: React.CSSProperties = {
    background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
    border: 'none',
    boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
  };

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d' }} className="hover:bg-iron-800/10 transition-colors">
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
            <div className="text-sm font-medium text-iron-50">{color.name}</div>
            <div className="text-xs text-iron-500 font-mono">{color.hex}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-iron-400">
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
            <span className="text-xs text-iron-400">g</span>
            <button onClick={handleSaveManual} className="btn-primary btn-sm text-xs">Save</button>
            <button onClick={() => { setEditing(false); setManualGrams(String(color.inventoryGrams.toFixed(0))); }} className="btn-secondary btn-sm text-xs">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: status === 'ok' ? '#e5e5e5' : style.color }}>
              {Math.max(0, netGrams).toFixed(0)}g
            </span>
            {isAdmin && (
              <button
                onClick={() => { setManualGrams(String(color.inventoryGrams.toFixed(1))); setEditing(true); }}
                className="text-iron-500 hover:text-iron-300 transition-colors"
                title="Set inventory amount"
                style={{ fontSize: 12, lineHeight: 1 }}
              >
                ✎
              </button>
            )}
            {pct !== null && (
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
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ color: style.color, background: style.bg }}
        >
          {style.label}
        </span>
      </td>
      {isAdmin && (
        <td className="px-4 py-3">
          {addingGrams ? (
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
              <span className="text-xs text-iron-400">g</span>
              <button onClick={handleAddSpool} className="btn-primary btn-sm text-xs">Add</button>
              <button onClick={() => setAddingGrams(false)} className="btn-secondary btn-sm text-xs">✕</button>
            </div>
          ) : (
            <button
              onClick={openAddSpool}
              className="btn-secondary btn-sm text-xs"
              title="Add spool — enter weight to add"
            >
              + Spool
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

export const FilamentPage: React.FC = () => {
  const { colors, isLoading } = useColors();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [filter, setFilter] = useState<'all' | 'low' | 'critical'>('all');

  const activeColors = colors.filter((c) => c.active);

  const filtered = activeColors.filter((c) => {
    if (filter === 'all') return true;
    const s = stockStatus(c);
    if (filter === 'critical') return s === 'critical' || s === 'empty';
    if (filter === 'low') return s === 'low' || s === 'critical' || s === 'empty';
    return true;
  });

  const criticalCount = activeColors.filter((c) => { const s = stockStatus(c); return s === 'critical' || s === 'empty'; }).length;
  const lowCount = activeColors.filter((c) => stockStatus(c) === 'low').length;
  const totalGrams = activeColors.reduce((s, c) => s + Math.max(0, filamentGrams(c)), 0);

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-iron-50">Filament Inventory</h1>
          <p className="text-sm text-iron-400 mt-0.5">
            {totalGrams.toFixed(0)}g total across {activeColors.length} active colors
          </p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={filter === 'all' ? { background: '#ff9900', color: '#0a0a0a' } : { background: '#2d2d2d', color: '#9ca3af' }}
        >
          All ({activeColors.length})
        </button>
        {lowCount > 0 && (
          <button
            onClick={() => setFilter('low')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={filter === 'low' ? { background: '#fb923c', color: '#0a0a0a' } : { background: '#422006', color: '#fdba74' }}
          >
            Low ({lowCount})
          </button>
        )}
        {criticalCount > 0 && (
          <button
            onClick={() => setFilter('critical')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={filter === 'critical' ? { background: '#ef4444', color: '#fff' } : { background: '#450a0a', color: '#fca5a5' }}
          >
            Critical ({criticalCount})
          </button>
        )}
      </div>

      <div className="card-surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Color</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-32">Manufacturer</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-48">Inventory</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-24">Status</th>
              {isAdmin && <th className="px-4 py-2.5 w-28" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <ColorInventoryRow key={c.id} color={c} isAdmin={isAdmin} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-iron-500 text-sm">
                  {filter === 'all' ? 'No active colors' : 'No colors in this category'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

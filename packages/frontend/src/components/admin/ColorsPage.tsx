import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useColors } from '../../hooks/useColors';
import { useManufacturers } from '../../hooks/useManufacturers';
import { useAuth } from '../../context/AuthContext';
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

// ── Stock-status helpers (ported from the retired FilamentPage during
// BP #18 Phase 2). Net grams = stored inventory minus the empty spool
// weight from the color's manufacturer. Thresholds default to 200g
// critical / 500g low when no manufacturer is set.

export function filamentGrams(color: Color): number {
  return color.inventoryGrams - (color.manufacturer?.emptySpoolWeightG ?? 0);
}

export type StockStatus = 'ok' | 'low' | 'critical' | 'empty';

export function stockStatus(color: Color): StockStatus {
  const net = filamentGrams(color);
  const critical = color.manufacturer?.criticalThresholdG ?? 200;
  const low = color.manufacturer?.lowThresholdG ?? 500;
  if (net <= 0) return 'empty';
  if (net <= critical) return 'critical';
  if (net <= low) return 'low';
  return 'ok';
}

// STOCK_STYLE removed in Change #159 — the stock-level pill was replaced
// by a single Active/Inactive button in the Status column. The Low /
// Critical / Empty signal still surfaces via the colored inventory
// progress bar driven by STOCK_BAR_COLOR below.

const STOCK_BAR_COLOR: Record<StockStatus, string> = {
  ok: '#4ade80',
  low: '#fb923c',
  critical: '#ef4444',
  empty: '#4b5563',
};

// Net grams + a slim progress bar that fills against the manufacturer's
// full-spool net weight. When the color has no manufacturer the bar is
// hidden (no scale to render against). Ported from FilamentPage.
function InventoryReadout({ color }: { color: Color }) {
  const net = filamentGrams(color);
  const disabled = !color.active;
  const status = stockStatus(color);
  const pct = color.manufacturer
    ? Math.min(100, Math.max(0, Math.round((net / color.manufacturer.fullSpoolNetWeightG) * 100)))
    : null;
  return (
    <div className="flex items-center gap-2 min-w-[140px] justify-end">
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: disabled ? '#6b7280' : '#ffffff' }}
      >
        {Math.max(0, net).toFixed(0)}g
      </span>
      {pct !== null && !disabled && (
        <div
          className="h-1.5 w-20 rounded-full overflow-hidden"
          style={{ background: '#2d2d2d' }}
          title={`${pct}% of a full ${color.manufacturer?.fullSpoolNetWeightG}g spool`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: STOCK_BAR_COLOR[status] }}
          />
        </div>
      )}
    </div>
  );
}

// StockPill was removed in Change #159 — the single Active/Inactive
// toggle button replaced it. The Low/Critical visibility still surfaces
// via the colored inventory progress bar in InventoryReadout above.

function AddColorForm({ onDone }: { onDone: () => void }) {
  const { create, isCreating } = useColors();
  const { manufacturers } = useManufacturers();
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#ff9900');
  const [manufacturerId, setManufacturerId] = useState<string>('');
  const [isMultiColor, setIsMultiColor] = useState(false);
  const [additionalHexes, setAdditionalHexes] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await create({
      name: name.trim(),
      hex,
      manufacturerId: manufacturerId ? parseInt(manufacturerId) : null,
      isMultiColor,
      additionalHexes: isMultiColor ? additionalHexes : [],
    });
    setName('');
    setHex('#ff9900');
    setManufacturerId('');
    setIsMultiColor(false);
    setAdditionalHexes([]);
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
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-xs font-medium text-white cursor-pointer">
          <input
            type="checkbox"
            checked={isMultiColor}
            onChange={(e) => {
              setIsMultiColor(e.target.checked);
              if (!e.target.checked) setAdditionalHexes([]);
              else if (additionalHexes.length === 0) setAdditionalHexes(['#ffffff']);
            }}
          />
          Multi-color filament
        </label>
        {isMultiColor && (
          <MultiHexEditor hexes={additionalHexes} onChange={setAdditionalHexes} />
        )}
      </div>
    </form>
  );
}

// Editor for the additional_hexes[] array on multi-color filaments.
// Up to 3 secondaries (matches the backend cap). Each row is a color
// input + hex string input. "+ Add another" appends; ✕ removes.
function MultiHexEditor({
  hexes,
  onChange,
}: {
  hexes: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#ff9900' }}>
        Additional colors
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {hexes.map((h, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={h}
              onChange={(e) => {
                const next = [...hexes];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              value={h}
              onChange={(e) => {
                const next = [...hexes];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="w-24 px-2 py-1 rounded text-iron-50 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              style={inputSt}
            />
            <button
              type="button"
              onClick={() => onChange(hexes.filter((_, j) => j !== i))}
              className="text-white/60 hover:text-white text-xs px-1"
              aria-label="Remove this color"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        {hexes.length < 3 && (
          <button
            type="button"
            onClick={() => onChange([...hexes, '#ffffff'])}
            className="btn-secondary btn-sm text-xs"
          >
            + Add another
          </button>
        )}
      </div>
    </div>
  );
}

// Renders the primary hex plus any secondaries as a split circle/pill.
// Single-color rows render unchanged. For multi-color, the swatch is
// divided into N vertical bands so the customer/admin sees every hex
// in the filament at a glance.
function SplitSwatch({
  primary,
  additional,
  size = 28,
}: {
  primary: string;
  additional: string[];
  size?: number;
}) {
  const all = [primary, ...additional];
  if (all.length === 1) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: primary,
          border: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
    );
  }
  // CSS conic-gradient for N≥2 — equal slices, no math required.
  const slice = 360 / all.length;
  const stops = all
    .map((hex, i) => `${hex} ${i * slice}deg ${(i + 1) * slice}deg`)
    .join(', ');
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${stops})`,
        border: '1px solid rgba(255,255,255,0.15)',
        flexShrink: 0,
      }}
      aria-hidden="true"
      title={all.join(' / ')}
    />
  );
}

function ColorRow({ color, index, isAdmin }: { color: Color; index: number; isAdmin: boolean }) {
  const { update, delete: deleteColor } = useColors();
  const { manufacturers } = useManufacturers();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);
  const [manufacturerId, setManufacturerId] = useState<string>(color.manufacturerId ? String(color.manufacturerId) : '');
  const [inventoryGrams, setInventoryGrams] = useState(color.inventoryGrams.toFixed(1));
  const [isMultiColor, setIsMultiColor] = useState(color.isMultiColor);
  const [additionalHexes, setAdditionalHexes] = useState<string[]>(color.additionalHexes ?? []);
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
      isMultiColor,
      additionalHexes: isMultiColor ? additionalHexes : [],
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
        <td className="px-4 py-2 align-top">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <input value={hex} onChange={(e) => setHex(e.target.value)} className="w-24 px-2 py-1 rounded text-iron-50 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiColor}
                onChange={(e) => {
                  setIsMultiColor(e.target.checked);
                  if (!e.target.checked) setAdditionalHexes([]);
                  else if (additionalHexes.length === 0) setAdditionalHexes(['#ffffff']);
                }}
              />
              Multi-color
            </label>
            {isMultiColor && (
              <MultiHexEditor hexes={additionalHexes} onChange={setAdditionalHexes} />
            )}
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
            <button
              onClick={() => {
                setName(color.name);
                setHex(color.hex);
                setInventoryGrams(color.inventoryGrams.toFixed(1));
                setIsMultiColor(color.isMultiColor);
                setAdditionalHexes(color.additionalHexes ?? []);
                setEditing(false);
              }}
              className="btn-secondary btn-sm text-xs"
            >
              Cancel
            </button>
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
          <SplitSwatch primary={color.hex} additional={color.additionalHexes ?? []} />
          <div className="flex flex-col">
            <span className="font-mono text-xs text-white">{color.hex}</span>
            {color.isMultiColor && color.additionalHexes && color.additionalHexes.length > 0 && (
              <span className="font-mono text-[10px] text-white/60">
                + {color.additionalHexes.join(' / ')}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-white">{color.name}</td>
      <td className="px-4 py-3 text-xs text-white">{color.manufacturer?.name ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <InventoryReadout color={color} />
          {isAdmin && (addingGrams ? (
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
          ))}
        </div>
      </td>
      {/* Status — single button (Active green / Inactive grey), same
          convention as /products. Change #159 dropped the separate
          stock-level pill (OK/Low/Critical) from this column — the
          colored inventory progress bar already conveys that signal. */}
      <td className="px-4 py-3">
        {isAdmin ? (
          <button
            onClick={() => update(color.id, { active: !color.active })}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
            style={color.active
              ? { background: '#15803d', color: '#ffffff' }
              : { background: '#6b7280', color: '#ffffff' }
            }
            title={color.active ? 'Disable this color' : 'Enable this color'}
          >
            {color.active ? 'Active' : 'Inactive'}
          </button>
        ) : (
          <span className="text-xs text-white/60">{color.active ? 'Active' : 'Inactive'}</span>
        )}
      </td>
      {/* Multi-color flag — Change #159 — surfaced as a dedicated column
          with toggle button. Flipping off clears any stored additional
          hexes so they don't dangle. Admin still uses the row's Edit
          mode to manage the actual hex slots when multi-color is on. */}
      <td className="px-4 py-3">
        {isAdmin ? (
          <button
            onClick={() => update(color.id, {
              isMultiColor: !color.isMultiColor,
              additionalHexes: !color.isMultiColor ? (color.additionalHexes ?? []) : [],
            })}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
            style={color.isMultiColor
              ? { background: '#15803d', color: '#ffffff' }
              : { background: '#6b7280', color: '#ffffff' }
            }
            title={color.isMultiColor
              ? 'Click to mark as single-color (clears additional hexes)'
              : 'Click to mark as multi-color, then Edit to add secondary hex(es)'
            }
          >
            {color.isMultiColor ? 'Multi' : 'Single'}
          </button>
        ) : (
          <span className="text-xs text-white/60">{color.isMultiColor ? 'Multi' : 'Single'}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          {isAdmin && (
            <>
              <button onClick={() => setEditing(true)} className="btn-secondary btn-sm text-xs">Edit</button>
              <button onClick={handleDelete} className="btn-danger btn-sm text-xs">Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export const ColorsPage: React.FC = () => {
  const { colors, isLoading } = useColors();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('bambuddy-last-sync') : null),
  );
  const [dedupeOpen, setDedupeOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'critical'>('all');
  // Phase 4 — manufacturer + active-state filters + sort. Component
  // state only (no URL persistence in v1; no shareable views yet).
  const [manufacturerFilter, setManufacturerFilter] = useState<'all' | 'unassigned' | number>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'disabled'>('all');
  type SortKey = 'name' | 'hex' | 'manufacturer' | 'inventory';
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // When the user picks a sort column, default to that column's natural
  // direction (asc for text, desc for inventory) on FIRST select; if
  // they hit the same column again, the explicit ↑/↓ button takes over.
  const handleSortByChange = (key: SortKey) => {
    if (key !== sortBy) {
      setSortBy(key);
      setSortDir(key === 'inventory' ? 'desc' : 'asc');
    }
  };

  const queryClient = useQueryClient();

  // Summary stats + filter chip counts. Computed off the unfiltered
  // catalog so the chips and header reflect reality regardless of the
  // current filter selection. Net grams = stored grams − empty-spool
  // weight (so the summary matches the dashboard pills).
  const activeColors = React.useMemo(() => colors.filter((c) => c.active), [colors]);
  const disabledCount = colors.length - activeColors.length;
  const totalGrams = React.useMemo(
    () => activeColors.reduce((s, c) => s + Math.max(0, filamentGrams(c)), 0),
    [activeColors],
  );
  const lowCount = React.useMemo(
    () => activeColors.filter((c) => stockStatus(c) === 'low').length,
    [activeColors],
  );
  const criticalCount = React.useMemo(
    () => activeColors.filter((c) => {
      const s = stockStatus(c);
      return s === 'critical' || s === 'empty';
    }).length,
    [activeColors],
  );

  // Manufacturer options for the dropdown — every distinct manufacturer
  // in the catalog + an "Unassigned" bucket if any. Counts are computed
  // off the unfiltered `colors` so the dropdown shows real totals.
  const manufacturerOptions = React.useMemo(() => {
    const byId = new Map<number, { id: number; name: string; count: number }>();
    let unassigned = 0;
    for (const c of colors) {
      if (c.manufacturerId && c.manufacturer) {
        const existing = byId.get(c.manufacturerId);
        if (existing) existing.count++;
        else byId.set(c.manufacturerId, { id: c.manufacturerId, name: c.manufacturer.name, count: 1 });
      } else {
        unassigned++;
      }
    }
    return {
      list: Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)),
      unassigned,
    };
  }, [colors]);

  // Filter chips narrow the VISIBLE rows. The dedupe button still
  // operates against the full `colors` array (it never reads `visible`),
  // so any combination of filters can't hide dupes from the dedupe modal.
  // Filters AND-combine; sort applies last.
  const visible = React.useMemo(() => {
    let out = colors;

    // Stock-level filter (only applies to active colors — disabled rows
    // don't carry a meaningful Low/Critical reading).
    if (stockFilter !== 'all') {
      out = out.filter((c) => {
        if (!c.active) return false;
        const s = stockStatus(c);
        if (stockFilter === 'critical') return s === 'critical' || s === 'empty';
        if (stockFilter === 'low') return s === 'low';
        return true;
      });
    }

    // Active/Disabled filter.
    if (activeFilter === 'active') out = out.filter((c) => c.active);
    else if (activeFilter === 'disabled') out = out.filter((c) => !c.active);

    // Manufacturer filter.
    if (manufacturerFilter === 'unassigned') {
      out = out.filter((c) => !c.manufacturerId);
    } else if (typeof manufacturerFilter === 'number') {
      out = out.filter((c) => c.manufacturerId === manufacturerFilter);
    }

    // Sort — return a fresh array so we never mutate the cache.
    const sorted = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'hex') cmp = a.hex.localeCompare(b.hex);
      else if (sortBy === 'manufacturer') {
        cmp = (a.manufacturer?.name ?? '').localeCompare(b.manufacturer?.name ?? '');
      } else if (sortBy === 'inventory') {
        cmp = filamentGrams(a) - filamentGrams(b);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [colors, stockFilter, activeFilter, manufacturerFilter, sortBy, sortDir]);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/filament-color-administration.png" alt="Colors" />
            <div>
              <h2 className="text-xl font-semibold text-iron-50">Color Catalog</h2>
              <p className="text-sm text-white mt-0.5">
                {totalGrams.toLocaleString(undefined, { maximumFractionDigits: 0 })}g total
                {' · '}
                {activeColors.length} active
                {disabledCount > 0 ? `, ${disabledCount} disabled` : ''}
                {lastSync && <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>· Last BamBuddy sync: {lastSync}</span>}
              </p>
            </div>
          </div>
        </div>
        {isAdmin && (
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
        )}
      </div>

      {showAdd && isAdmin && <AddColorForm onDone={() => setShowAdd(false)} />}

      {/* Stock filter chips — hidden when there's nothing to highlight.
          Dedupe button operates against the FULL `colors` array regardless
          of the selected chip; see comment on the `visible` memo. */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStockFilter('all')}
          className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
          style={stockFilter === 'all'
            ? { background: '#ff9900', color: '#0a0a0a' }
            : { background: '#2d2d2d', color: '#ffffff' }
          }
        >
          All ({colors.length})
        </button>
        {lowCount > 0 && (
          <button
            onClick={() => setStockFilter('low')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
            style={stockFilter === 'low'
              ? { background: '#eab308', color: '#000000' }
              : { background: '#2d2d2d', color: '#ffffff' }
            }
          >
            Low ({lowCount})
          </button>
        )}
        {criticalCount > 0 && (
          <button
            onClick={() => setStockFilter('critical')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
            style={stockFilter === 'critical'
              ? { background: '#b91c1c', color: '#ffffff' }
              : { background: '#2d2d2d', color: '#ffffff' }
            }
          >
            Critical ({criticalCount})
          </button>
        )}
      </div>

      {/* Phase 4 — manufacturer + active filters + sort. Visible to all
          authenticated users (read-only operations). AND-combines with
          the stock-level chips above. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Manufacturer</label>
          <select
            value={String(manufacturerFilter)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all' || v === 'unassigned') setManufacturerFilter(v);
              else setManufacturerFilter(parseInt(v, 10));
            }}
            className="px-3 py-1.5 rounded-md text-xs text-iron-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            style={inputSt}
          >
            <option value="all">All manufacturers ({colors.length})</option>
            {manufacturerOptions.unassigned > 0 && (
              <option value="unassigned">Unassigned ({manufacturerOptions.unassigned})</option>
            )}
            {manufacturerOptions.list.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.count})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Active state</label>
          <div className="inline-flex rounded-md overflow-hidden" style={{ background: '#2d2d2d' }}>
            {(['all', 'active', 'disabled'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setActiveFilter(opt)}
                className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                style={activeFilter === opt
                  ? { background: opt === 'active' ? '#15803d' : opt === 'disabled' ? '#6b7280' : '#ff9900', color: opt === 'all' ? '#0a0a0a' : '#ffffff' }
                  : { background: 'transparent', color: '#ffffff' }
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Sort by</label>
          <div className="flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => handleSortByChange(e.target.value as SortKey)}
              className="px-3 py-1.5 rounded-md text-xs text-iron-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
              style={inputSt}
            >
              <option value="name">Name</option>
              <option value="hex">Hex</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="inventory">Inventory (g)</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="px-2 py-1.5 rounded-md text-xs font-semibold text-white"
              style={{ background: '#3a3a3a' }}
              title={`Sort ${sortDir === 'asc' ? 'ascending' : 'descending'} — click to flip`}
              aria-label={`Sort direction: ${sortDir}`}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="ml-auto text-[11px] font-mono tabular-nums text-white/60 pb-1">
          Showing {visible.length} of {colors.length}
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold w-40" style={{ color: '#ff9900' }}>Swatch</th>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: '#ff9900' }}>Name</th>
              <th className="text-left px-4 py-2.5 font-semibold w-32" style={{ color: '#ff9900' }}>Manufacturer</th>
              {/* Change #159 — widened from w-52 (208px) to w-72 (288px) so
                  the gram readout + progress bar + + Spool button stop
                  wrapping. */}
              <th className="text-right px-4 py-2.5 font-semibold w-72 whitespace-nowrap" style={{ color: '#ff9900' }}>Inventory</th>
              <th className="text-left px-4 py-2.5 font-semibold w-28" style={{ color: '#ff9900' }}>Status</th>
              <th className="text-left px-4 py-2.5 font-semibold w-28" style={{ color: '#ff9900' }}>Multi</th>
              <th className="px-4 py-2.5 w-32" />
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => <ColorRow key={c.id} color={c} index={i} isAdmin={isAdmin} />)}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white text-sm">
                {stockFilter === 'all' ? 'No colors yet' : 'No colors in this category'}
              </td></tr>
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
// Extracts the material family token (matches the backend helper of
// the same name). "PLA Basic" → "pla", "ABS-GF" → "abs", "PETG-CF" →
// "petg", "TPU 95A" → "tpu". Used by the confirm dialog to block
// cross-family submissions before they hit the network.
function materialFamily(m: string | null | undefined): string | null {
  if (!m) return null;
  const match = m.trim().toLowerCase().match(/^[a-z0-9]+/);
  return match ? match[0] : null;
}

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
  // Change #159 follow-up — per-row "include in merge" checkboxes so
  // admin can hand-pick which rows participate when a group spans
  // multiple filaments (e.g. 1 ABS + 2 PLA at the same hex). Map of
  // groupKey → Set of row IDs marked for merge. Default state on first
  // refresh: every row checked (matches the old "merge all" behavior).
  const [selected, setSelected] = useState<Record<string, Set<number>>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Change #159 follow-up — backend groups by (UPPER(hex),
  // material_family). PLA green and PETG-HF green at the same hex are
  // physically distinct filaments and surface as separate groups
  // (which means neither will appear as a duplicate when each is the
  // sole row in its family).
  const groupKey = (g: ColorDuplicateGroup): string =>
    `${g.hex.toUpperCase()}|${g.materialFamily}`;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const g = await colorApi.findDuplicates();
      setGroups(g);
      // Default each group's keeper to the linked row if any; else
      // lowest id. Default selection: every row in the group is checked
      // (matches pre-#159-followup "merge all" behavior). Admin unchecks
      // rows that shouldn't participate (e.g. the ABS in a PLA group).
      const nextKeepers: Record<string, number> = {};
      const nextSelected: Record<string, Set<number>> = {};
      for (const grp of g) {
        const key = groupKey(grp);
        const linked = grp.rows.find((r) => r.bambuddyId !== null);
        nextKeepers[key] = linked ? linked.id : grp.rows[0].id;
        nextSelected[key] = new Set(grp.rows.map((r) => r.id));
      }
      setKeepers(nextKeepers);
      setSelected(nextSelected);
    } catch (err: any) {
      toast.error(`Failed to load duplicates: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle one row's checked state. If the row being unchecked is the
  // current keeper, promote the next remaining checked row to keeper
  // (or clear the keeper when nothing's left).
  const toggleRow = (groupKeyStr: string, rowId: number, group: ColorDuplicateGroup) => {
    setSelected((prev) => {
      const cur = new Set(prev[groupKeyStr] ?? []);
      if (cur.has(rowId)) cur.delete(rowId);
      else cur.add(rowId);
      return { ...prev, [groupKeyStr]: cur };
    });
    if (keepers[groupKeyStr] === rowId) {
      // We're unchecking the keeper — find a replacement among the
      // remaining checked rows.
      const remaining = group.rows.filter(
        (r) => r.id !== rowId && selected[groupKeyStr]?.has(r.id),
      );
      const linked = remaining.find((r) => r.bambuddyId !== null);
      const nextKeeper = linked?.id ?? remaining[0]?.id ?? 0;
      if (nextKeeper) {
        setKeepers((prev) => ({ ...prev, [groupKeyStr]: nextKeeper }));
      }
    }
  };

  React.useEffect(() => { refresh(); }, [refresh]);

  const handleMerge = async (group: ColorDuplicateGroup) => {
    const key = groupKey(group);
    const keepId = keepers[key];
    if (!keepId) return;
    const keeper = group.rows.find((r) => r.id === keepId);
    if (!keeper) return;
    // Only operate on rows the admin has explicitly checked. Excludes
    // the keeper itself (already chosen via radio) so the same row
    // isn't both keeper and merge-candidate.
    const selectedIds = selected[key] ?? new Set<number>();
    const mergeRows = group.rows.filter(
      (r) => r.id !== keepId && selectedIds.has(r.id),
    );
    if (mergeRows.length === 0) {
      alert('No rows selected to merge into the keeper. Check the boxes on the rows you want to absorb.');
      return;
    }
    const mergeIds = mergeRows.map((r) => r.id);

    // Surface any identity diffs to the admin BEFORE the merge runs.
    // Material-family mismatches are HARD-BLOCKED before the network
    // call — backend would refuse anyway, but this gives a friendlier
    // experience. Same-family variants (PLA vs PLA Basic vs PLA-CF)
    // and other dimensions (manufacturer / multi / additional hexes)
    // flow through with the keeper's values winning.
    const keeperFamily = materialFamily(keeper.material);
    const familyClashes: string[] = [];
    for (const r of mergeRows) {
      const rowFamily = materialFamily(r.material);
      if (rowFamily && keeperFamily && rowFamily !== keeperFamily) {
        familyClashes.push(
          `  #${r.id} (${r.name}): "${r.material}" (${rowFamily}) ≠ keeper's "${keeper.material}" (${keeperFamily})`,
        );
      }
    }
    if (familyClashes.length > 0) {
      alert(
        `Can't merge across different filament families.\n\n` +
        `These rows are physically distinct filaments from the keeper — same hex but different material family (PLA, ABS, PETG, etc.) means different melt temperatures and properties:\n\n` +
        familyClashes.join('\n') +
        `\n\nUncheck these rows OR pick a different keeper that matches their family.`,
      );
      return;
    }

    const keeperHexes = [...keeper.additionalHexes].map((h) => h.toUpperCase()).sort().join(',');
    const diffNotes: string[] = [];
    for (const r of mergeRows) {
      const rowHexes = [...r.additionalHexes].map((h) => h.toUpperCase()).sort().join(',');
      const diffs: string[] = [];
      if ((r.material ?? null) !== (keeper.material ?? null)) {
        diffs.push(`material ${r.material ?? '∅'} → keeper's ${keeper.material ?? '∅'}`);
      }
      if ((r.manufacturerId ?? null) !== (keeper.manufacturerId ?? null)) {
        diffs.push(`manufacturer ${r.manufacturerName ?? '∅'} → keeper's ${keeper.manufacturerName ?? '∅'}`);
      }
      if (r.isMultiColor !== keeper.isMultiColor) {
        diffs.push(`multi-color ${r.isMultiColor ? 'on' : 'off'} → keeper's ${keeper.isMultiColor ? 'on' : 'off'}`);
      }
      if (rowHexes !== keeperHexes) {
        diffs.push(`additional hexes [${rowHexes || '∅'}] → keeper's [${keeperHexes || '∅'}]`);
      }
      if (diffs.length > 0) {
        diffNotes.push(`  #${r.id} (${r.name}): ${diffs.join(', ')}`);
      }
    }

    const lines = [
      `Merge ${mergeRows.length} of ${group.rows.length} row(s) of ${group.hex} into color #${keepId} (${keeper.name})?`,
      '',
      'Invoice references will be repointed to the keeper. This cannot be undone (but historical invoice math is unaffected — line items snapshot their own prices).',
    ];
    if (diffNotes.length > 0) {
      lines.push(
        '',
        'Identity diffs being absorbed (keeper\'s values win):',
        ...diffNotes,
      );
    }
    if (!confirm(lines.join('\n'))) return;
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
              Rows are grouped by hex + material family — PLA green and
              PETG-HF green at the same hex are different filaments and
              show as separate groups (or won't show at all if neither
              has dupes). Check the rows you want to merge, pick a
              keeper, hit Merge. Variants within a family (PLA / PLA
              Basic / PLA-CF) merge fine; the keeper's label wins.
            </p>
            {groups.map((group) => {
              const key = groupKey(group);
              const isBusy = busyKey === key;
              const groupSelected = selected[key] ?? new Set<number>();
              const allChecked = group.rows.every((r) => groupSelected.has(r.id));
              const selectedCount = group.rows.filter((r) => groupSelected.has(r.id)).length;
              const checkedExceptKeeper = group.rows.filter(
                (r) => r.id !== keepers[key] && groupSelected.has(r.id),
              ).length;
              return (
                <div
                  key={key}
                  className="rounded-lg p-3 space-y-2"
                  style={{ background: '#1a1a1a', border: '1px solid #2d2d2d' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-block w-5 h-5 rounded"
                      style={{ background: group.hex, border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                    <span className="font-mono text-xs text-white">{group.hex}</span>
                    {group.materialFamily && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-widest"
                        style={{ background: '#3a3a3a', color: '#ffffff' }}
                        title={`Material family — all rows in this group share "${group.materialFamily}" as their leading material token. Example label in this group: ${group.sampleMaterial ?? '(none)'}`}
                      >
                        {group.materialFamily}
                      </span>
                    )}
                    <span className="text-xs text-white/50">· {selectedCount} of {group.count} selected</span>
                    <button
                      type="button"
                      onClick={() => setSelected((p) => ({
                        ...p,
                        [key]: allChecked ? new Set() : new Set(group.rows.map((r) => r.id)),
                      }))}
                      className="text-[10px] text-white/60 hover:text-white underline"
                    >
                      {allChecked ? 'Clear all' : 'Select all'}
                    </button>
                    <button
                      className="ml-auto btn-primary btn-sm"
                      onClick={() => handleMerge(group)}
                      disabled={isBusy || checkedExceptKeeper === 0}
                      title={checkedExceptKeeper === 0
                        ? 'Check at least one non-keeper row to merge'
                        : `Merge ${checkedExceptKeeper} row(s) into keeper #${keepers[key]}`
                      }
                    >
                      {isBusy ? 'Merging…' : `Merge ${checkedExceptKeeper} → keep #${keepers[key]}`}
                    </button>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left" style={{ color: '#ff9900' }}>
                        <th className="py-1 pr-2">In</th>
                        <th className="py-1 pr-2">Keep</th>
                        <th className="py-1 pr-2">#ID</th>
                        <th className="py-1 pr-2">Name</th>
                        <th className="py-1 pr-2">Mfr</th>
                        <th className="py-1 pr-2">Material</th>
                        <th className="py-1 pr-2">Multi</th>
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
                          isChecked={groupSelected.has(row.id)}
                          onPick={() => setKeepers((p) => ({ ...p, [key]: row.id }))}
                          onToggleCheck={() => toggleRow(key, row.id, group)}
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
  isChecked,
  onPick,
  onToggleCheck,
}: {
  row: ColorDuplicateRow;
  isKeeper: boolean;
  isChecked: boolean;
  onPick: () => void;
  onToggleCheck: () => void;
}) {
  const linked = row.bambuddyId !== null;
  return (
    <tr
      style={{
        background: isKeeper
          ? 'rgba(255, 153, 0, 0.08)'
          : !isChecked ? 'rgba(0, 0, 0, 0.25)' : 'transparent',
        opacity: !isChecked ? 0.55 : 1,
      }}
    >
      <td className="py-1 pr-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggleCheck}
          aria-label={`Include color #${row.id} in merge`}
          title="Check to include this row in the merge; uncheck to leave it alone"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type="radio"
          name={`keeper-${row.hex}`}
          checked={isKeeper}
          onChange={onPick}
          disabled={!isChecked}
          aria-label={`Keep color #${row.id}`}
          title={isChecked
            ? 'Mark this row as the keeper — others merge into it'
            : 'Check the row first to make it eligible as keeper'
          }
        />
      </td>
      <td className="py-1 pr-2 font-mono text-white">#{row.id}</td>
      <td className="py-1 pr-2 text-white">{row.name}</td>
      <td className="py-1 pr-2 text-white/70">{row.manufacturerName ?? '—'}</td>
      <td className="py-1 pr-2 text-white/70">{row.material ?? '—'}</td>
      <td className="py-1 pr-2">
        {row.isMultiColor ? (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: '#6d28d9', color: '#ffffff' }}
            title={`Additional hexes: ${row.additionalHexes.join(' / ') || '(none stored)'}`}
          >
            MULTI
          </span>
        ) : (
          <span className="text-white/40 text-[10px]">—</span>
        )}
      </td>
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

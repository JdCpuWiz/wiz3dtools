import React, { useState } from 'react';
import { useColors } from '../../hooks/useColors';
import { useManufacturers } from '../../hooks/useManufacturers';
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
      <h3 className="font-semibold text-iron-50">Add Color</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-iron-300 mb-1">Color Name</label>
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
          <label className="block text-xs font-medium text-iron-300 mb-1">Hex Color</label>
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
            <label className="block text-xs font-medium text-iron-300 mb-1">Manufacturer</label>
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

function ColorRow({ color }: { color: Color }) {
  const { update, delete: deleteColor, addSpool } = useColors();
  const { manufacturers } = useManufacturers();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);
  const [manufacturerId, setManufacturerId] = useState<string>(color.manufacturerId ? String(color.manufacturerId) : '');

  const save = async () => {
    await update(color.id, {
      name: name.trim(),
      hex,
      manufacturerId: manufacturerId ? parseInt(manufacturerId) : null,
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
        <td className="px-4 py-2 text-sm text-iron-400">{color.inventoryGrams.toFixed(0)}g</td>
        <td className="px-4 py-2 text-sm text-iron-400">{color.active ? 'Active' : 'Inactive'}</td>
        <td className="px-4 py-2">
          <div className="flex gap-1.5">
            <button onClick={save} className="btn-primary btn-sm text-xs">Save</button>
            <button onClick={() => { setName(color.name); setHex(color.hex); setEditing(false); }} className="btn-secondary btn-sm text-xs">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #2d2d2d' }} className="transition-colors hover:bg-iron-800/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: color.hex,
              border: '2px solid rgba(255,255,255,0.15)',
              flexShrink: 0,
            }}
          />
          <span className="font-mono text-xs text-iron-400">{color.hex}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-iron-50">{color.name}</td>
      <td className="px-4 py-3 text-xs text-iron-400">{color.manufacturer?.name ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-iron-300">{color.inventoryGrams.toFixed(0)}g</span>
          <button
            onClick={() => addSpool(color.id)}
            className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
            style={{ background: '#2d2d2d', color: '#ff9900', border: '1px solid rgba(255,153,0,0.3)' }}
            title={`Add ${color.manufacturer?.fullSpoolNetWeightG ?? 1000}g spool`}
          >
            + Spool
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => update(color.id, { active: !color.active })}
          className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
          style={
            color.active
              ? { background: 'rgba(34,197,94,0.2)', color: '#4ade80' }
              : { background: 'rgba(107,114,128,0.2)', color: '#9ca3af' }
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

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-iron-50">Color Catalog</h2>
          <p className="text-sm text-iron-400 mt-0.5">Manage print colors, manufacturers, and inventory</p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ Add Color</button>
        )}
      </div>

      {showAdd && <AddColorForm onDone={() => setShowAdd(false)} />}

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-40">Swatch</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-32">Manufacturer</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-40">Inventory</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100 w-24">Status</th>
              <th className="px-4 py-2.5 w-32" />
            </tr>
          </thead>
          <tbody>
            {colors.map((c) => <ColorRow key={c.id} color={c} />)}
            {colors.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-iron-500 text-sm">No colors yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

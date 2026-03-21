import React, { useState } from 'react';
import { useManufacturers } from '../../hooks/useManufacturers';
import { useColors } from '../../hooks/useColors';
import type { Manufacturer, Color } from '@wizqueue/shared';

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

function NumberInput({
  label, value, onChange, unit = 'g',
}: {
  label: string; value: string; onChange: (v: string) => void; unit?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-iron-300 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={inputSt}
        />
        <span className="text-xs text-iron-400">{unit}</span>
      </div>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { create, isCreating } = useManufacturers();
  const [name, setName] = useState('');
  const [empty, setEmpty] = useState('');
  const [net, setNet] = useState('');
  const [low, setLow] = useState('500');
  const [critical, setCritical] = useState('200');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !empty || !net) return;
    await create({
      name: name.trim(),
      emptySpoolWeightG: parseFloat(empty),
      fullSpoolNetWeightG: parseFloat(net),
      lowThresholdG: parseFloat(low),
      criticalThresholdG: parseFloat(critical),
    });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-iron-50">Add Manufacturer</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-iron-300 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bambu Lab"
            className="w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={inputSt}
            autoFocus
          />
        </div>
        <NumberInput label="Empty Spool Weight" value={empty} onChange={setEmpty} />
        <NumberInput label="Full Spool Net Weight" value={net} onChange={setNet} />
        <NumberInput label="Low Stock Threshold" value={low} onChange={setLow} />
        <NumberInput label="Critical Threshold" value={critical} onChange={setCritical} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || !empty || !net || isCreating} className="btn-primary btn-sm">
          {isCreating ? 'Adding…' : 'Add Manufacturer'}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary btn-sm">Cancel</button>
      </div>
    </form>
  );
}

function ColorEditRow({ color }: { color: Color }) {
  const { update } = useColors();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);

  const save = async () => {
    await update(color.id, { name: name.trim(), hex });
    setEditing(false);
  };

  const cancel = () => {
    setName(color.name);
    setHex(color.hex);
    setEditing(false);
  };

  return (
    <tr style={{ borderTop: '1px solid #2a2a2a' }}>
      <td className="pl-8 pr-3 py-2">
        <div className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: color.hex, border: `2px solid ${color.hex}`, flexShrink: 0 }} />
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"
              />
              <input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="w-24 px-2 py-1 rounded text-iron-50 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                style={inputSt}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                autoFocus
                className="w-48 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                style={inputSt}
              />
              <button onClick={save} className="btn-primary btn-sm text-xs">Save</button>
              <button onClick={cancel} className="btn-secondary btn-sm text-xs">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-iron-100">{color.name}</span>
              <span className="text-xs text-iron-500 font-mono">{color.hex}</span>
              {!color.active && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#374151', color: '#9ca3af' }}>Disabled</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm text-xs">Edit</button>
        )}
      </td>
    </tr>
  );
}

function ManufacturerRow({ mfg, colors, index }: { mfg: Manufacturer; colors: Color[]; index: number }) {
  const { update, delete: deleteMfg } = useManufacturers();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(mfg.name);
  const [empty, setEmpty] = useState(String(mfg.emptySpoolWeightG));
  const [net, setNet] = useState(String(mfg.fullSpoolNetWeightG));
  const [low, setLow] = useState(String(mfg.lowThresholdG));
  const [critical, setCritical] = useState(String(mfg.criticalThresholdG));

  const mfgColors = colors.filter((c) => c.manufacturerId === mfg.id);

  const save = async () => {
    await update(mfg.id, {
      name: name.trim(),
      emptySpoolWeightG: parseFloat(empty),
      fullSpoolNetWeightG: parseFloat(net),
      lowThresholdG: parseFloat(low),
      criticalThresholdG: parseFloat(critical),
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${mfg.name}"? This will unlink all colors from this manufacturer.`)) return;
    deleteMfg(mfg.id);
  };

  return (
    <>
      {editing ? (
        <tr style={{ borderTop: '1px solid #2d2d2d', background: 'rgba(230,138,0,0.05)' }}>
          <td className="px-4 py-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={empty} onChange={(e) => setEmpty(e.target.value)} className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={net} onChange={(e) => setNet(e.target.value)} className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={low} onChange={(e) => setLow(e.target.value)} className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={critical} onChange={(e) => setCritical(e.target.value)} className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" style={inputSt} />
          </td>
          <td className="px-4 py-2">
            <div className="flex gap-1.5">
              <button onClick={save} className="btn-primary btn-sm text-xs">Save</button>
              <button onClick={() => setEditing(false)} className="btn-secondary btn-sm text-xs">Cancel</button>
            </div>
          </td>
        </tr>
      ) : (
        <tr style={{ borderTop: '1px solid #2d2d2d', background: index % 2 === 0 ? '#181818' : '#232323' }} className="hover:bg-iron-800/20 transition-colors">
          <td className="px-4 py-3 text-sm font-medium text-iron-50">{mfg.name}</td>
          <td className="px-4 py-3 text-sm text-iron-300">{mfg.emptySpoolWeightG}g</td>
          <td className="px-4 py-3 text-sm text-iron-300">{mfg.fullSpoolNetWeightG}g</td>
          <td className="px-4 py-3">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#d97706', color: '#ffffff' }}>
              {mfg.lowThresholdG}g
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#b91c1c', color: '#ffffff' }}>
              {mfg.criticalThresholdG}g
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-1.5 items-center">
              {mfgColors.length > 0 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="btn-secondary btn-sm text-xs whitespace-nowrap"
                >
                  {expanded ? '▲' : '▼'} Colors ({mfgColors.length})
                </button>
              )}
              <button onClick={() => setEditing(true)} className="btn-secondary btn-sm text-xs">Edit</button>
              <button onClick={handleDelete} className="btn-danger btn-sm text-xs">Delete</button>
            </div>
          </td>
        </tr>
      )}

      {expanded && mfgColors.length > 0 && (
        <tr style={{ borderTop: '1px solid #2d2d2d' }}>
          <td colSpan={6} className="px-0 py-0">
            <div style={{ background: 'rgba(0,0,0,0.25)' }}>
              <table className="w-full text-sm">
                <tbody>
                  {mfgColors.map((c) => (
                    <ColorEditRow key={c.id} color={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export const ManufacturersPage: React.FC = () => {
  const { manufacturers, isLoading } = useManufacturers();
  const { colors } = useColors();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-iron-50">Filament Manufacturers</h2>
          <p className="text-sm text-iron-400 mt-0.5">Manage spool weights and stock thresholds per manufacturer</p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ Add Manufacturer</button>
        )}
      </div>

      {showAdd && <AddForm onDone={() => setShowAdd(false)} />}

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'linear-gradient(to bottom, #4a4a4a, #3a3a3a)' }}>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Empty Spool</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Net Filament</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Low Threshold</th>
              <th className="text-left px-4 py-2.5 font-semibold text-iron-100">Critical Threshold</th>
              <th className="px-4 py-2.5 w-48" />
            </tr>
          </thead>
          <tbody>
            {manufacturers.map((m, i) => <ManufacturerRow key={m.id} mfg={m} colors={colors} index={i} />)}
            {manufacturers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-iron-500 text-sm">No manufacturers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

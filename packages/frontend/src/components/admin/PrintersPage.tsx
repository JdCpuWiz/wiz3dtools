import React, { useState } from 'react';
import { usePrinters } from '../../hooks/usePrinters';
import { useAuth } from '../../context/AuthContext';
import type { Printer } from '@wizqueue/shared';

interface BambuFields {
  ipAddress: string;
  serialNumber: string;
  accessCode: string;
}

const emptyBambu = (): BambuFields => ({ ipAddress: '', serialNumber: '', accessCode: '' });

export const PrintersPage: React.FC = () => {
  const { printers, create, update, delete: deletePrinter } = usePrinters();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Add form
  const [newName, setNewName]   = useState('');
  const [newModel, setNewModel] = useState('');
  const [newBambu, setNewBambu] = useState<BambuFields>(emptyBambu());

  // Edit state
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editName, setEditName]     = useState('');
  const [editModel, setEditModel]   = useState('');
  const [editBambu, setEditBambu]   = useState<BambuFields>(emptyBambu());
  const [showCode, setShowCode]     = useState<Record<number, boolean>>({});

  const handleAdd = () => {
    if (!newName.trim()) return;
    create({
      name: newName.trim(),
      model: newModel.trim() || undefined,
      active: true,
      ipAddress: newBambu.ipAddress.trim() || undefined,
      serialNumber: newBambu.serialNumber.trim() || undefined,
      accessCode: newBambu.accessCode.trim() || undefined,
    });
    setNewName('');
    setNewModel('');
    setNewBambu(emptyBambu());
  };

  const startEdit = (p: Printer) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditModel(p.model || '');
    setEditBambu({
      ipAddress: p.ipAddress || '',
      serialNumber: p.serialNumber || '',
      accessCode: '',  // never pre-fill access code
    });
  };

  const saveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    const updateData: any = {
      name: editName.trim(),
      model: editModel.trim() || undefined,
      ipAddress: editBambu.ipAddress.trim() || undefined,
      serialNumber: editBambu.serialNumber.trim() || undefined,
    };
    // Only send accessCode if user typed something
    if (editBambu.accessCode.trim()) {
      updateData.accessCode = editBambu.accessCode.trim();
    }
    update({ id: editingId, data: updateData });
    setEditingId(null);
  };

  const handleDelete = (p: Printer) => {
    if (window.confirm(`Delete printer "${p.name}"?`)) deletePrinter(p.id);
  };

  const toggleActive = (p: Printer) => {
    update({ id: p.id, data: { active: !p.active } });
  };

  const hasBambuConfig = (p: Printer) => !!(p.ipAddress && p.serialNumber);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-iron-50">Printers</h2>
        <p className="text-iron-400 text-sm mt-1">
          Manage printers for queue assignment. Bambu fields enable live monitoring.
        </p>
      </div>

      {/* Add form — admin only */}
      {isAdmin && (
        <div className="card space-y-4">
          <p className="text-sm font-medium text-iron-200">Add Printer</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-iron-300 mb-1">Name *</label>
              <input className="input" style={{ width: 160 }} value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Jarvis" />
            </div>
            <div>
              <label className="block text-xs font-medium text-iron-300 mb-1">Model</label>
              <input className="input" style={{ width: 140 }} value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Bambu P1S" />
            </div>
          </div>
          <div className="border-t pt-3" style={{ borderColor: '#3a3a3a' }}>
            <p className="text-xs text-iron-400 mb-2">Bambu Configuration (optional — enables live monitoring)</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-iron-300 mb-1">IP Address</label>
                <input className="input" style={{ width: 160 }} value={newBambu.ipAddress}
                  onChange={(e) => setNewBambu({ ...newBambu, ipAddress: e.target.value })}
                  placeholder="192.168.x.x" />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-300 mb-1">Serial Number</label>
                <input className="input" style={{ width: 160 }} value={newBambu.serialNumber}
                  onChange={(e) => setNewBambu({ ...newBambu, serialNumber: e.target.value })}
                  placeholder="01P09C..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-300 mb-1">Access Code</label>
                <input className="input" style={{ width: 130 }} type="password"
                  value={newBambu.accessCode}
                  onChange={(e) => setNewBambu({ ...newBambu, accessCode: e.target.value })}
                  placeholder="8-digit code" />
              </div>
            </div>
          </div>
          <button className="btn-primary btn-sm" disabled={!newName.trim()} onClick={handleAdd}>
            Add Printer
          </button>
        </div>
      )}

      {/* Printers list */}
      <div className="space-y-3">
        {printers.length === 0 && (
          <div className="card text-center text-iron-500 py-8">No printers configured yet.</div>
        )}
        {printers.map((p, idx) => (
          <div
            key={p.id}
            className="card"
            style={{ opacity: p.active ? 1 : 0.55, background: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : undefined }}
          >
            {editingId === p.id ? (
              /* ── Edit mode ── */
              <div className="space-y-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-iron-300 mb-1">Name *</label>
                    <input className="input" style={{ width: 160 }} value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-300 mb-1">Model</label>
                    <input className="input" style={{ width: 140 }} value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} />
                  </div>
                </div>
                <div className="border-t pt-3" style={{ borderColor: '#3a3a3a' }}>
                  <p className="text-xs text-iron-400 mb-2">Bambu Configuration</p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-iron-300 mb-1">IP Address</label>
                      <input className="input" style={{ width: 160 }} value={editBambu.ipAddress}
                        onChange={(e) => setEditBambu({ ...editBambu, ipAddress: e.target.value })}
                        placeholder="192.168.x.x" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-iron-300 mb-1">Serial Number</label>
                      <input className="input" style={{ width: 160 }} value={editBambu.serialNumber}
                        onChange={(e) => setEditBambu({ ...editBambu, serialNumber: e.target.value })}
                        placeholder="01P09C..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-iron-300 mb-1">
                        Access Code{' '}
                        <span className="text-iron-600">(leave blank to keep existing)</span>
                      </label>
                      <input className="input" style={{ width: 130 }} type="password"
                        value={editBambu.accessCode}
                        onChange={(e) => setEditBambu({ ...editBambu, accessCode: e.target.value })}
                        placeholder="New code only" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={saveEdit}>Save</button>
                  <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              /* ── Read mode ── */
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-iron-100">{p.name}</span>
                    {p.model && <span className="text-iron-500 text-sm ml-2">{p.model}</span>}
                  </div>
                  {/* Bambu config badge */}
                  {hasBambuConfig(p) ? (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: '#1d4ed8', color: '#ffffff' }}
                    >
                      Bambu ✓
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: '#4b5563', color: '#ffffff' }}
                    >
                      No Bambu config
                    </span>
                  )}
                  {p.ipAddress && (
                    <span className="text-iron-500 text-xs">{p.ipAddress}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <button
                      onClick={() => toggleActive(p)}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={p.active
                        ? { background: '#15803d', color: '#ffffff' }
                        : { background: '#6b7280', color: '#ffffff' }}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  ) : (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={p.active
                        ? { background: '#15803d', color: '#ffffff' }
                        : { background: '#6b7280', color: '#ffffff' }}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => startEdit(p)} className="btn-secondary btn-sm">Edit</button>
                      <button onClick={() => handleDelete(p)} className="btn-danger btn-sm">Delete</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-iron-600 text-xs">
        After adding or changing Bambu config, restart the bambu-monitor service for changes to take effect.
      </p>
    </div>
  );
};

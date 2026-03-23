import React, { useState } from 'react';
import { usePrinters } from '../../hooks/usePrinters';
import { useAuth } from '../../context/AuthContext';
import type { Printer } from '@wizqueue/shared';

export const PrintersPage: React.FC = () => {
  const { printers, create, update, delete: deletePrinter } = usePrinters();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [newName, setNewName] = useState('');
  const [newModel, setNewModel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editModel, setEditModel] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    create({ name: newName.trim(), model: newModel.trim() || undefined, active: true });
    setNewName('');
    setNewModel('');
  };

  const startEdit = (p: Printer) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditModel(p.model || '');
  };

  const saveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    update({ id: editingId, data: { name: editName.trim(), model: editModel.trim() || undefined } });
    setEditingId(null);
  };

  const handleDelete = (p: Printer) => {
    if (window.confirm(`Delete printer "${p.name}"?`)) {
      deletePrinter(p.id);
    }
  };

  const toggleActive = (p: Printer) => {
    update({ id: p.id, data: { active: !p.active } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-iron-50">Printers</h2>
        <p className="text-iron-400 text-sm mt-1">Manage your printer list for queue assignment.</p>
      </div>

      {/* Add form — admin only */}
      {isAdmin && (
        <div className="card flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-iron-300 mb-1">Printer Name *</label>
            <input
              className="input"
              style={{ width: 200 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. P1S #1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-iron-300 mb-1">Model (optional)</label>
            <input
              className="input"
              style={{ width: 160 }}
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Bambu P1S"
            />
          </div>
          <button
            className="btn-primary btn-sm"
            disabled={!newName.trim()}
            onClick={handleAdd}
          >
            Add Printer
          </button>
        </div>
      )}

      {/* Printers list */}
      <div className="card p-0 overflow-hidden">
        <table className="wiz-table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>Status</th>
              {isAdmin && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {printers.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 4 : 3} className="text-center text-iron-500 py-8">
                  No printers configured yet.
                </td>
              </tr>
            )}
            {printers.map((p, idx) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5, background: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : undefined }}>
                <td>
                  {editingId === p.id ? (
                    <input
                      className="input"
                      style={{ width: 180 }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-iron-100">{p.name}</span>
                  )}
                </td>
                <td>
                  {editingId === p.id ? (
                    <input
                      className="input"
                      style={{ width: 140 }}
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      placeholder="e.g. Bambu P1S"
                    />
                  ) : (
                    <span className="text-iron-400 text-sm">{p.model || '—'}</span>
                  )}
                </td>
                <td>
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
                </td>
                {isAdmin && (
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {editingId === p.id ? (
                        <>
                          <button onClick={saveEdit} className="btn-primary btn-sm">Save</button>
                          <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(p)} className="btn-secondary btn-sm">Edit</button>
                          <button onClick={() => handleDelete(p)} className="btn-danger btn-sm">Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

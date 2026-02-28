import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import type { User } from '@wizqueue/shared';

function AddUserForm({ onClose }: { onClose: () => void }) {
  const { createUser, isCreating } = useUsers();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    try {
      await createUser({ username: username.trim(), password, email: email.trim() || undefined, role });
      onClose();
    } catch {
      // toast already shown by hook
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-iron-50">Add User</h2>
        <button onClick={onClose} className="text-iron-500 hover:text-iron-300 text-lg leading-none">×</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Username *</label>
          <input
            className="input w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Password *</label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Email</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Role</label>
          <select
            className="input w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isCreating || !username.trim() || !password.trim()} className="btn-primary btn-sm">
            {isCreating ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordRow({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { resetPassword } = useUsers();
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!newPassword.trim()) return;
    setSaving(true);
    try {
      await resetPassword(userId, newPassword);
      onClose();
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td colSpan={5} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="password"
            className="input flex-1 max-w-xs"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') onClose();
            }}
          />
          <button
            onClick={handleConfirm}
            disabled={saving || !newPassword.trim()}
            className="btn-primary btn-sm"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function UserRow({ user, currentUserId }: { user: User; currentUserId: number }) {
  const { updateUser, deleteUser } = useUsers();
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(user.email || '');
  const [showReset, setShowReset] = useState(false);
  const isOwnRow = user.id === currentUserId;

  const saveEmail = async () => {
    setEditingEmail(false);
    const newEmail = emailValue.trim() || null;
    if (newEmail === (user.email || null)) return;
    try {
      await updateUser(user.id, { email: newEmail });
    } catch {
      setEmailValue(user.email || '');
    }
  };

  const handleRoleChange = async (role: string) => {
    try {
      await updateUser(user.id, { role });
    } catch {
      // toast shown
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
    } catch {
      // toast shown
    }
  };

  const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <>
      <tr>
        <td className="px-4 py-3 font-medium text-iron-50">{user.username}</td>
        <td className="px-4 py-3">
          {editingEmail ? (
            <input
              className="input w-full max-w-xs"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              onBlur={saveEmail}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEmail();
                if (e.key === 'Escape') { setEditingEmail(false); setEmailValue(user.email || ''); }
              }}
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingEmail(true)}
              className="text-iron-300 hover:text-iron-50 text-left group flex items-center gap-1"
            >
              <span>{user.email || <span className="text-iron-500 italic">—</span>}</span>
              <svg className="w-3.5 h-3.5 text-iron-500 group-hover:text-iron-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.829 2.829L11.828 15.828A2 2 0 0110 16.414V17h.586a2 2 0 001.414-.586l.536-.535" />
              </svg>
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <select
            className="input py-1 text-sm"
            value={user.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={isOwnRow}
            title={isOwnRow ? 'Cannot change your own role' : undefined}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </td>
        <td className="px-4 py-3 text-iron-400 text-sm">{createdDate}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReset((v) => !v)}
              className="btn-secondary btn-sm"
            >
              Reset Password
            </button>
            <button
              onClick={handleDelete}
              disabled={isOwnRow}
              className="btn-danger btn-sm"
              title={isOwnRow ? 'Cannot delete your own account' : undefined}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {showReset && (
        <ResetPasswordRow userId={user.id} onClose={() => setShowReset(false)} />
      )}
    </>
  );
}

export function UsersPage() {
  const { user } = useAuth();
  const { users, isLoading } = useUsers();
  const [showAdd, setShowAdd] = useState(false);

  if (user?.role !== 'admin') {
    return (
      <div className="card text-center py-12">
        <p className="text-iron-300 text-lg font-medium">Access denied</p>
        <p className="text-iron-500 text-sm mt-1">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-iron-50">Users</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn-primary btn-sm"
        >
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAdd && <AddUserForm onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <div className="card text-center py-8 text-iron-400">Loading…</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-iron-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <UserRow key={u.id} user={u} currentUserId={user.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

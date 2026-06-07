import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWholesaleUsers } from '../../hooks/useWholesaleUsers';
import { useCustomers } from '../../hooks/useCustomers';
import { PageIcon } from '../common/PageIcon';
import type { Customer } from '@wizqueue/shared';
import type { WholesaleUser } from '../../services/api';

const customerLabel = (c: Customer): string => c.businessName?.trim() || c.contactName;

/**
 * Wholesale Account admin (BuildPlan #11 Phase 1).
 *
 * Source of truth for these accounts lives in the wiz3d-prints DB —
 * this page CRUDs them via the wiz3dtools backend's `/api/wholesale-users`
 * proxy, which forwards to wiz3d-prints' `/api/admin/wholesale` with a
 * shared X-Admin-Token header.
 *
 * Customer-ID picker is a typeahead against the wiz3dtools customer
 * list (since we're in-app) — much friendlier than asking Wiz to paste
 * a numeric ID from another tab.
 */
export function WholesalePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { users, isLoading, createUser, updateUser, deleteUser, isCreating, isUpdating } =
    useWholesaleUsers();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<WholesaleUser | null>(null);

  if (!isAdmin) {
    return (
      <div className="card text-center text-white">
        Admin access required.
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PageIcon src="/icons/customers.png" alt="Wholesale" />
            <h1 className="text-2xl font-bold text-iron-50">Wholesale Accounts</h1>
          </div>
          {!showCreate && !editTarget && (
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
              + New Wholesale Account
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          Logins for wholesale.wiz3dprints.com. Contact &amp; address info lives on the
          linked Wiz3DTools customer record.
        </p>
      </div>

      {showCreate && (
        <WholesaleForm
          onCancel={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await createUser({
              name: data.name,
              email: data.email,
              password: data.password!,
              wiz3dtoolsCustomerId: data.wiz3dtoolsCustomerId ?? null,
            });
            setShowCreate(false);
          }}
          isSaving={isCreating}
          mode="create"
        />
      )}

      {editTarget && (
        <WholesaleForm
          existing={editTarget}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (data) => {
            await updateUser(editTarget.id, {
              name: data.name,
              email: data.email,
              ...(data.password ? { password: data.password } : {}),
              active: data.active,
              wiz3dtoolsCustomerId: data.wiz3dtoolsCustomerId ?? null,
            });
            setEditTarget(null);
          }}
          isSaving={isUpdating}
          mode="edit"
        />
      )}

      {isLoading ? (
        <div className="card text-center text-white">Loading…</div>
      ) : users.length === 0 ? (
        <div className="card text-center" style={{ color: '#9ca3af' }}>
          No wholesale accounts yet. Click + New Wholesale Account to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Linked Customer</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <WholesaleRow
                  key={u.id}
                  user={u}
                  onEdit={() => setEditTarget(u)}
                  onToggleActive={() => updateUser(u.id, { active: !u.active })}
                  onDelete={async () => {
                    if (!confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
                    await deleteUser(u.id);
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

function WholesaleRow({
  user,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  user: WholesaleUser;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { customers } = useCustomers();
  const linked = customers?.find((c) => c.id === user.wiz3dtoolsCustomerId);

  return (
    <tr>
      <td className="font-medium text-white">{user.name}</td>
      <td style={{ color: '#9ca3af' }}>{user.email}</td>
      <td>
        {user.wiz3dtoolsCustomerId == null ? (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#4b5563', color: '#ffffff' }}>
            unlinked
          </span>
        ) : linked ? (
          <span className="text-white">{customerLabel(linked)}</span>
        ) : (
          <span className="text-xs font-mono" style={{ color: '#9ca3af' }}>
            #{user.wiz3dtoolsCustomerId} (missing)
          </span>
        )}
      </td>
      <td>
        <button
          onClick={onToggleActive}
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={
            user.active
              ? { background: '#15803d', color: '#ffffff' }
              : { background: '#6b7280', color: '#ffffff' }
          }
        >
          {user.active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="text-xs" style={{ color: '#9ca3af' }}>
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button onClick={onEdit} className="btn-secondary btn-sm">
            Edit
          </button>
          <button onClick={onDelete} className="btn-danger btn-sm">
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

interface FormData {
  name: string;
  email: string;
  password?: string;
  active: boolean;
  wiz3dtoolsCustomerId: number | null;
}

function WholesaleForm({
  existing,
  onSubmit,
  onCancel,
  isSaving,
  mode,
}: {
  existing?: WholesaleUser;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  mode: 'create' | 'edit';
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(existing?.active ?? true);
  const [customerId, setCustomerId] = useState<number | null>(
    existing?.wiz3dtoolsCustomerId ?? null,
  );

  const { customers } = useCustomers();
  const [customerQuery, setCustomerQuery] = useState('');
  const selectedCustomer = useMemo(
    () => customers?.find((c) => c.id === customerId),
    [customers, customerId],
  );
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          customerLabel(c).toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (mode === 'create' && !password) return;
    await onSubmit({
      name: name.trim(),
      email: email.trim(),
      password: password || undefined,
      active,
      wiz3dtoolsCustomerId: customerId,
    });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>
          {mode === 'create' ? 'New Wholesale Account' : `Edit ${existing?.name ?? ''}`}
        </h2>
        <button onClick={onCancel} className="text-iron-500 hover:text-iron-300 text-lg leading-none">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Full name *</label>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Email *</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>
            Password {mode === 'create' ? '*' : <span className="text-xs font-normal" style={{ color: '#9ca3af' }}>(leave blank to keep current)</span>}
          </label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required={mode === 'create'}
            autoComplete="new-password"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>
            Linked Wiz3DTools Customer
          </label>
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded" style={{ background: '#2d2d2d', color: '#e5e5e5' }}>
                {customerLabel(selectedCustomer)}
                {selectedCustomer.email ? (
                  <span className="ml-2 text-xs" style={{ color: '#9ca3af' }}>
                    {selectedCustomer.email}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerId(null);
                  setCustomerQuery('');
                }}
                className="btn-secondary btn-sm"
              >
                Unlink
              </button>
            </div>
          ) : (
            <>
              <input
                className="input w-full"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Type customer name or email…"
              />
              {filteredCustomers.length > 0 && (
                <div
                  className="mt-2 rounded border max-h-48 overflow-y-auto"
                  style={{ background: '#1a1a1a', borderColor: '#2d2d2d' }}
                >
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerQuery('');
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-iron-800"
                      style={{ color: '#e5e5e5' }}
                    >
                      <div className="text-sm font-medium">{customerLabel(c)}</div>
                      {c.email && (
                        <div className="text-xs" style={{ color: '#9ca3af' }}>{c.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
            Links this wholesale login to a customer record for invoicing / orders.
            Leave unlinked if they only need portal access.
          </p>
        </div>

        {mode === 'edit' && (
          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: '#ff9900' }}>Active</label>
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={
                active
                  ? { background: '#15803d', color: '#ffffff' }
                  : { background: '#6b7280', color: '#ffffff' }
              }
            >
              {active ? 'Active' : 'Inactive'}
            </button>
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !name.trim() || !email.trim() || (mode === 'create' && !password)}
            className="btn-primary btn-sm"
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Account' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useWholesaleUsers } from '../../hooks/useWholesaleUsers';

/**
 * Wholesale-access panel — rendered on the Customer detail page.
 *
 * Wholesale login is just a property of a customer (BuildPlan #11
 * Phase 1.5): one list, no separate admin page. If this customer has
 * wholesale access, show toggle/reset/revoke. If not, show "Enable
 * wholesale access" with an inline password set.
 *
 * Email comes from the customer record — we never re-collect it here.
 * That guarantees the wholesale login email and the customer's
 * billing/contact email always match.
 */
export function WholesaleAccessPanel({
  customerId,
  customerName,
  customerEmail,
}: {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
}) {
  const { users, isLoading, createUser, updateUser, deleteUser, isCreating, isUpdating } =
    useWholesaleUsers();

  const existing = useMemo(
    () => users.find((u) => u.wiz3dtoolsCustomerId === customerId) ?? null,
    [users, customerId],
  );

  const [enabling, setEnabling] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetPassword, setResetPasswordVal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const emailMissing = !customerEmail || !customerEmail.trim();
  const emailMismatch = existing && customerEmail && existing.email.toLowerCase() !== customerEmail.toLowerCase();

  const handleEnable = async () => {
    if (!customerEmail || !newPassword) return;
    setError(null);
    try {
      await createUser({
        name: customerName,
        email: customerEmail,
        password: newPassword,
        wiz3dtoolsCustomerId: customerId,
      });
      setEnabling(false);
      setNewPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable');
    }
  };

  const handleReset = async () => {
    if (!existing || !resetPassword) return;
    setError(null);
    try {
      await updateUser(existing.id, { password: resetPassword });
      setResetting(false);
      setResetPasswordVal('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    }
  };

  const handleSyncEmail = async () => {
    if (!existing || !customerEmail) return;
    setError(null);
    try {
      await updateUser(existing.id, { email: customerEmail });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync email');
    }
  };

  const handleToggleActive = async () => {
    if (!existing) return;
    setError(null);
    try {
      await updateUser(existing.id, { active: !existing.active });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle');
    }
  };

  const handleRevoke = async () => {
    if (!existing) return;
    if (!confirm(`Revoke wholesale access for ${existing.email}? They will no longer be able to sign in.`)) return;
    setError(null);
    try {
      await deleteUser(existing.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke');
    }
  };

  return (
    <div className="card-surface">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d2d2d]">
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#ff9900' }}>
          Wholesale Access
        </h3>
        {existing && (
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={
              existing.active
                ? { background: '#15803d', color: '#ffffff' }
                : { background: '#6b7280', color: '#ffffff' }
            }
          >
            {existing.active ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading && (
          <p className="text-sm" style={{ color: '#9ca3af' }}>Loading…</p>
        )}

        {!isLoading && !existing && (
          <>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              This customer cannot sign in to wholesale.wiz3dprints.com yet.
            </p>
            {emailMissing ? (
              <p className="text-sm rounded p-3" style={{ background: '#3b1a1a', color: '#f87171' }}>
                Add an email to this customer first — wholesale login uses their email as the username.
              </p>
            ) : enabling ? (
              <div className="space-y-2">
                <label className="block text-xs font-medium" style={{ color: '#ff9900' }}>
                  Initial password for {customerEmail}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="set a starter password they'll change later"
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={isCreating || !newPassword}
                    className="btn-primary btn-sm"
                  >
                    {isCreating ? 'Enabling…' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEnabling(false); setNewPassword(''); }}
                    className="btn-secondary btn-sm"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEnabling(true)}
                className="btn-primary btn-sm"
                disabled={emailMissing}
              >
                + Enable wholesale access
              </button>
            )}
          </>
        )}

        {!isLoading && existing && (
          <>
            <div className="text-sm" style={{ color: '#9ca3af' }}>
              <span className="text-white">{existing.email}</span> can sign in to wholesale.wiz3dprints.com.
              {existing.active ? '' : ' Currently disabled.'}
            </div>

            {emailMismatch && (
              <div
                className="flex items-center justify-between gap-3 rounded p-3"
                style={{ background: '#3b1a1a', color: '#f87171' }}
              >
                <span className="text-sm">
                  Login email <code className="font-mono text-xs">{existing.email}</code> doesn&apos;t
                  match this customer&apos;s email <code className="font-mono text-xs">{customerEmail}</code>.
                </span>
                <button
                  type="button"
                  onClick={handleSyncEmail}
                  disabled={isUpdating}
                  className="btn-primary btn-sm whitespace-nowrap"
                >
                  Sync email
                </button>
              </div>
            )}

            {resetting ? (
              <div className="space-y-2">
                <label className="block text-xs font-medium" style={{ color: '#ff9900' }}>
                  New password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={resetPassword}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    placeholder="new password"
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isUpdating || !resetPassword}
                    className="btn-primary btn-sm"
                  >
                    {isUpdating ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetting(false); setResetPasswordVal(''); }}
                    className="btn-secondary btn-sm"
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={isUpdating}
                  className="btn-secondary btn-sm"
                >
                  {existing.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setResetting(true)}
                  disabled={isUpdating}
                  className="btn-secondary btn-sm"
                >
                  Set new password
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isUpdating}
                  className="btn-danger btn-sm"
                >
                  Revoke access
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-sm rounded p-2" style={{ background: '#3b1a1a', color: '#f87171' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

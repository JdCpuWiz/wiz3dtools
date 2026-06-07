import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../../hooks/useCustomers';
import { useWholesaleUsers } from '../../hooks/useWholesaleUsers';
import { useAuth } from '../../context/AuthContext';
import { PageIcon } from '../common/PageIcon';

export const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const { customers, isLoading, delete: deleteCustomer } = useCustomers();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Wholesale list only loads for admins (proxied through requireAdmin
  // on the backend) — skip the column entirely for non-admins.
  const { users: wholesaleUsers } = useWholesaleUsers();
  const wholesaleByCustomerId = useMemo(() => {
    const m = new Map<number, { active: boolean }>();
    for (const u of wholesaleUsers) {
      if (u.wiz3dtoolsCustomerId != null) m.set(u.wiz3dtoolsCustomerId, { active: u.active });
    }
    return m;
  }, [wholesaleUsers]);

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageIcon src="/icons/customers.png" alt="Customers" />
          <h2 className="text-xl font-semibold text-iron-50">Customers</h2>
        </div>
        <button onClick={() => navigate('/customers/new')} className="btn-primary btn-sm">+ New Customer</button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-lg font-medium text-iron-50">No customers yet</p>
          <p className="text-sm mt-1 text-white">Create your first customer to get started</p>
        </div>
      ) : (
        <div className="card-surface">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">Business</th>
                <th className="hidden md:table-cell">Email</th>
                <th className="hidden lg:table-cell">Phone</th>
                {isAdmin && <th className="hidden md:table-cell">Wholesale</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const wholesale = wholesaleByCustomerId.get(customer.id);
                return (
                  <tr key={customer.id}>
                    <td className="font-medium text-white">{customer.contactName}</td>
                    <td className="text-white hidden sm:table-cell">{customer.businessName || '—'}</td>
                    <td className="text-white hidden md:table-cell">{customer.email || '—'}</td>
                    <td className="text-white hidden lg:table-cell">{customer.phone || '—'}</td>
                    {isAdmin && (
                      <td className="hidden md:table-cell">
                        {wholesale ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={
                              wholesale.active
                                ? { background: '#15803d', color: '#ffffff' }
                                : { background: '#6b7280', color: '#ffffff' }
                            }
                          >
                            {wholesale.active ? 'Active' : 'Inactive'}
                          </span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => navigate(`/customers/${customer.id}`)} className="btn-secondary btn-sm text-xs">Edit</button>
                        <button
                          onClick={() => { if (confirm(`Delete "${customer.contactName}"?`)) deleteCustomer(customer.id); }}
                          className="btn-danger btn-sm text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../../hooks/useCustomers';

export const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const { customers, isLoading, delete: deleteCustomer } = useCustomers();

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-iron-50">Customers</h2>
        <button onClick={() => navigate('/customers/new')} className="btn-primary btn-sm">+ New Customer</button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-lg font-medium text-iron-50">No customers yet</p>
          <p className="text-sm mt-1 text-iron-400">Create your first customer to get started</p>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-medium text-iron-50">{customer.contactName}</td>
                  <td className="text-iron-400 hidden sm:table-cell">{customer.businessName || '—'}</td>
                  <td className="text-iron-400 hidden md:table-cell">{customer.email || '—'}</td>
                  <td className="text-iron-400 hidden lg:table-cell">{customer.phone || '—'}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../../hooks/useCustomers';

export const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const { customers, isLoading, delete: deleteCustomer, isDeleting } = useCustomers();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Customers</h2>
        <button
          onClick={() => navigate('/customers/new')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
        >
          + New Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No customers yet</p>
          <p className="text-sm mt-1">Create your first customer to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Business</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Phone</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {customer.contactName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    {customer.businessName || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {customer.email || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {customer.phone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete customer "${customer.contactName}"?`)) {
                            deleteCustomer(customer.id);
                          }
                        }}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
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

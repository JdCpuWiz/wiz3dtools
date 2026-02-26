import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import type { SalesInvoice } from '@wizqueue/shared';

function calcTotal(invoice: SalesInvoice): number {
  const subtotal = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const tax = invoice.taxExempt ? 0 : subtotal * invoice.taxRate;
  return subtotal + tax;
}

export const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, isLoading, delete: deleteInvoice } = useSalesInvoices();

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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invoices</h2>
        <button
          onClick={() => navigate('/invoices/new')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
        >
          + New Invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="text-sm mt-1">Create your first invoice to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                    {invoice.customer
                      ? invoice.customer.businessName || invoice.customer.contactName
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                    ${calcTotal(invoice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {new Date(invoice.createdAt).toLocaleDateString('en-NZ')}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
                            deleteInvoice(invoice.id);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        Delete
                      </button>
                    )}
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

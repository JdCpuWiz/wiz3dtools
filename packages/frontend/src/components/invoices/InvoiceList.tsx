import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import type { SalesInvoice, SalesInvoiceStatus } from '@wizqueue/shared';

type InvoiceFilter = 'all' | SalesInvoiceStatus;

function calcTotal(invoice: SalesInvoice): number {
  const sub = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  return sub + (invoice.taxExempt ? 0 : sub * invoice.taxRate) + (invoice.shippingCost || 0);
}

export const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, isLoading, delete: deleteInvoice } = useSalesInvoices();
  const [filter, setFilter] = useState<InvoiceFilter>('all');

  const filtered = useMemo(() =>
    filter === 'all' ? invoices : invoices.filter((inv) => inv.status === filter),
    [invoices, filter]
  );

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-iron-50">Invoices</h2>
        <button onClick={() => navigate('/invoices/new')} className="btn-primary btn-sm">+ New Invoice</button>
      </div>

      <div className="inline-flex p-1 rounded-xl" style={{ background: 'rgba(10,10,10,0.6)' }}>
        {(['all', 'draft', 'sent', 'paid', 'cancelled'] as InvoiceFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 ${filter === f ? 'nav-tab-active' : 'nav-tab-inactive'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-lg font-medium text-iron-50">{filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}</p>
          <p className="text-sm mt-1 text-iron-400">{filter === 'all' ? 'Create your first invoice to get started' : 'Try a different filter'}</p>
        </div>
      ) : (
        <div className="card-surface">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th className="hidden sm:table-cell">Customer</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="hidden md:table-cell">Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <td className="font-medium" style={{ color: '#ff9900' }}>{invoice.invoiceNumber}</td>
                  <td className="text-iron-300 hidden sm:table-cell">
                    {invoice.customer
                      ? invoice.customer.businessName || invoice.customer.contactName
                      : <span className="text-iron-600">—</span>}
                  </td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td className="text-right font-semibold text-iron-50">${calcTotal(invoice).toFixed(2)}</td>
                  <td className="text-iron-400 hidden md:table-cell">
                    {new Date(invoice.createdAt).toLocaleDateString('en-NZ')}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => { if (confirm(`Delete ${invoice.invoiceNumber}?`)) deleteInvoice(invoice.id); }}
                        className="btn-danger btn-sm text-xs"
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

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { StatusBadge } from '../common/StatusBadge';
import type { SalesInvoice, SalesInvoiceStatus } from '@wizqueue/shared';

type InvoiceFilter = 'all' | SalesInvoiceStatus | 'shipped';
type SortCol = 'invoiceNumber' | 'customer' | 'date' | 'total';
type SortDir = 'asc' | 'desc';

function calcTotal(invoice: SalesInvoice): number {
  const sub = invoice.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  return sub + (invoice.taxExempt ? 0 : sub * invoice.taxRate) + (invoice.shippingCost || 0);
}

function customerName(invoice: SalesInvoice): string {
  return invoice.customer
    ? (invoice.customer.businessName || invoice.customer.contactName || '')
    : '';
}

export const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, isLoading, delete: deleteInvoice } = useSalesInvoices();
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const base = filter === 'all'
      ? invoices
      : filter === 'shipped'
        ? invoices.filter((inv) => !!inv.shippedAt)
        : invoices.filter((inv) => inv.status === filter && !inv.shippedAt);
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'invoiceNumber') cmp = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true });
      else if (sortCol === 'customer') cmp = customerName(a).localeCompare(customerName(b));
      else if (sortCol === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortCol === 'total') cmp = calcTotal(a) - calcTotal(b);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [invoices, filter, sortCol, sortDir]);

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
        {(['all', 'draft', 'sent', 'paid', 'shipped', 'cancelled'] as InvoiceFilter[]).map((f) => (
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
                {([
                  { col: 'invoiceNumber' as SortCol, label: 'Invoice #', cls: '' },
                  { col: 'customer' as SortCol, label: 'Customer', cls: 'hidden sm:table-cell' },
                  { col: null, label: 'Status', cls: '' },
                  { col: 'total' as SortCol, label: 'Total', cls: 'text-right' },
                  { col: 'date' as SortCol, label: 'Date', cls: 'hidden md:table-cell' },
                ] as { col: SortCol | null; label: string; cls: string }[]).map(({ col, label, cls }) => (
                  <th
                    key={label}
                    className={`${cls}${col ? ' cursor-pointer select-none hover:text-iron-50 transition-colors' : ''}`}
                    onClick={col ? () => handleSort(col) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {col && (
                        <span className="text-xs" style={{ color: sortCol === col ? '#ff9900' : '#4b5563' }}>
                          {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
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
                  <td><StatusBadge status={invoice.shippedAt ? 'shipped' : invoice.status} /></td>
                  <td className="text-right font-semibold text-iron-50">${calcTotal(invoice).toFixed(2)}</td>
                  <td className="text-iron-400 hidden md:table-cell">
                    {new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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

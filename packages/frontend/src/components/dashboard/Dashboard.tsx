import React from 'react';
import { Link } from 'react-router-dom';
import { useQueue } from '../../hooks/useQueue';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { useCustomers } from '../../hooks/useCustomers';
import { useProducts } from '../../hooks/useProducts';
import type { SalesInvoice } from '@wizqueue/shared';

interface StatCardProps {
  title: string;
  to: string;
  children: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, to, children }) => (
  <Link
    to={to}
    className="card block hover:shadow-lg transition-shadow hover:border-[#e68a00] border border-transparent"
    style={{ textDecoration: 'none' }}
  >
    <h2 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">{title}</h2>
    {children}
    <p className="text-xs text-[#6b7280] mt-4">View →</p>
  </Link>
);

const Pill: React.FC<{ label: string; count: number; color: string; bg: string }> = ({ label, count, color, bg }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-[#d1d5db]">{label}</span>
    <span
      className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm font-bold"
      style={{ color, background: bg }}
    >
      {count}
    </span>
  </div>
);

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: '#d1d5db', bg: '#2d2d2d',  label: 'Draft' },
  sent:      { color: '#93c5fd', bg: '#1e3a5f',  label: 'Sent' },
  paid:      { color: '#86efac', bg: '#14532d',  label: 'Paid' },
  shipped:   { color: '#2dd4bf', bg: '#0d3330',  label: 'Shipped' },
  cancelled: { color: '#fca5a5', bg: '#450a0a',  label: 'Cancelled' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const Dashboard: React.FC = () => {
  const { items: queueItems, isLoading: queueLoading } = useQueue();
  const { invoices, isLoading: invoicesLoading } = useSalesInvoices();
  const { customers, isLoading: customersLoading } = useCustomers();
  const { products, isLoading: productsLoading } = useProducts();

  const pending = queueItems.filter((i) => i.status === 'pending').length;
  const printing = queueItems.filter((i) => i.status === 'printing').length;
  const pendingQty = queueItems.filter((i) => i.status === 'pending').reduce((s, i) => s + i.quantity, 0);
  const printingQty = queueItems.filter((i) => i.status === 'printing').reduce((s, i) => s + i.quantity, 0);

  const draft = invoices.filter((i) => i.status === 'draft' && !i.shippedAt).length;
  const sent = invoices.filter((i) => i.status === 'sent' && !i.shippedAt).length;
  const shipped = invoices.filter((i) => !!i.shippedAt).length;
  const paid = invoices.filter((i) => i.status === 'paid' && !i.shippedAt).length;
  const cancelled = invoices.filter((i) => i.status === 'cancelled').length;

  const calcTotal = (inv: SalesInvoice): number => {
    const subtotal = inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
    const taxAmount = inv.taxExempt ? 0 : subtotal * inv.taxRate;
    return subtotal + taxAmount + (Number(inv.shippingCost) || 0);
  };

  const now = new Date();
  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const paidRevenue = paidInvoices.reduce((s, i) => s + calcTotal(i), 0);
  const outstanding = invoices.filter((i) => i.status === 'sent' && !i.shippedAt).reduce((s, i) => s + calcTotal(i), 0);
  const thisMonthRevenue = paidInvoices
    .filter((i) => {
      const d = new Date(i.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, i) => s + calcTotal(i), 0);

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const activeProducts = products.filter((p) => p.active).length;

  const recentInvoices = invoices.slice(0, 5);

  const isLoading = queueLoading || invoicesLoading || customersLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-[#9ca3af]">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#e5e5e5]">Dashboard</h1>
        <p className="text-sm text-[#9ca3af] mt-1">Business overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Print Queue */}
        <StatCard title="Print Queue" to="/queue">
          <div className="divide-y divide-[#2d2d2d]">
            <Pill
              label={`Pending${pendingQty !== pending ? ` (${pendingQty} pcs)` : ''}`}
              count={pending}
              color="#e5e5e5"
              bg="#2d2d2d"
            />
            <Pill
              label={`Printing${printingQty !== printing ? ` (${printingQty} pcs)` : ''}`}
              count={printing}
              color="#0a0a0a"
              bg="#ff9900"
            />
          </div>
          {queueItems.length === 0 && (
            <p className="text-sm text-[#6b7280] mt-2">Queue is empty</p>
          )}
        </StatCard>

        {/* Invoices */}
        <StatCard title="Invoices" to="/invoices">
          <div className="divide-y divide-[#2d2d2d]">
            <Pill label="Draft" count={draft} color="#d1d5db" bg="#2d2d2d" />
            <Pill label="Sent" count={sent} color="#93c5fd" bg="#1e3a5f" />
            <Pill label="Shipped" count={shipped} color="#2dd4bf" bg="#0d3330" />
            <Pill label="Paid" count={paid} color="#86efac" bg="#14532d" />
            {cancelled > 0 && (
              <Pill label="Cancelled" count={cancelled} color="#fca5a5" bg="#450a0a" />
            )}
          </div>
          {invoices.length === 0 && (
            <p className="text-sm text-[#6b7280] mt-2">No invoices yet</p>
          )}
          {(paidRevenue > 0 || outstanding > 0 || thisMonthRevenue > 0) && (
            <div className="mt-3 pt-3 border-t border-[#2d2d2d] space-y-1">
              {thisMonthRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9ca3af]">This Month</span>
                  <span className="text-sm font-semibold" style={{ color: '#ff9900' }}>{fmt(thisMonthRevenue)}</span>
                </div>
              )}
              {paidRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9ca3af]">Total Paid</span>
                  <span className="text-sm font-semibold" style={{ color: '#86efac' }}>{fmt(paidRevenue)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9ca3af]">Outstanding</span>
                  <span className="text-sm font-semibold" style={{ color: '#93c5fd' }}>{fmt(outstanding)}</span>
                </div>
              )}
            </div>
          )}
        </StatCard>

        {/* Customers */}
        <StatCard title="Customers" to="/customers">
          <div className="flex items-end gap-2 mt-2">
            <span className="text-5xl font-bold text-[#ff9900]">{customers.length}</span>
            <span className="text-sm text-[#9ca3af] mb-2">total</span>
          </div>
        </StatCard>

        {/* Products */}
        <StatCard title="Products" to="/products">
          <div className="flex items-end gap-2 mt-2">
            <span className="text-5xl font-bold text-[#ff9900]">{activeProducts}</span>
            <span className="text-sm text-[#9ca3af] mb-2">active</span>
          </div>
          {products.length > activeProducts && (
            <p className="text-xs text-[#6b7280] mt-1">{products.length - activeProducts} inactive</p>
          )}
        </StatCard>
      </div>

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <div className="card-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d2d2d]">
            <h2 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-widest">Recent Invoices</h2>
            <Link to="/invoices" className="text-xs text-[#ff9900] hover:text-[#e68a00]">View all →</Link>
          </div>
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => {
                const sc = statusColors[inv.shippedAt ? 'shipped' : inv.status] || statusColors.draft;
                return (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`} className="font-mono text-sm text-[#ff9900] hover:text-[#e68a00]">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-[#d1d5db]">
                      {inv.customer ? (inv.customer.businessName || inv.customer.contactName) : '—'}
                    </td>
                    <td className="text-[#9ca3af] text-sm">{fmtDate(inv.createdAt)}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: sc.color, background: sc.bg }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="text-right font-medium text-[#e5e5e5]">{fmt(calcTotal(inv))}</td>
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

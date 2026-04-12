import React from 'react';
import { Link } from 'react-router-dom';
import { PageIcon } from '../common/PageIcon';
import { useQueue } from '../../hooks/useQueue';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import { useProducts } from '../../hooks/useProducts';
import { useColors } from '../../hooks/useColors';
import { usePrinters } from '../../hooks/usePrinters';
import { usePrinterDashboard, formatTimeRemaining, getPrinterStatusStyle } from '../../hooks/usePrinterDashboard';
import type { SalesInvoice, Color, Printer, PrinterLiveStatus } from '@wizqueue/shared';

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
    <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#ff9900' }}>{title}</h2>
    {children}
    <p className="text-xs text-white mt-4">View →</p>
  </Link>
);

const Pill: React.FC<{ label: string; count: number; color: string; bg: string }> = ({ label, count, color, bg }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-white">{label}</span>
    <span
      className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm font-bold"
      style={{ color, background: bg }}
    >
      {count}
    </span>
  </div>
);

function netFilamentGrams(c: Color): number {
  return c.inventoryGrams - (c.manufacturer?.emptySpoolWeightG ?? 0);
}

function FilamentCard({ colors, neededColorIds }: { colors: Color[]; neededColorIds: Set<number> }) {
  const withInventory = colors.filter((c) => c.active);

  const critical = withInventory.filter((c) => {
    if (!neededColorIds.has(c.id)) return false;
    const net = netFilamentGrams(c);
    const threshold = c.manufacturer?.criticalThresholdG ?? 200;
    return net <= threshold;
  });
  const low = withInventory.filter((c) => {
    if (!neededColorIds.has(c.id)) return false;
    const net = netFilamentGrams(c);
    const criticalT = c.manufacturer?.criticalThresholdG ?? 200;
    const lowT = c.manufacturer?.lowThresholdG ?? 500;
    return net > criticalT && net <= lowT;
  });

  const sorted = [...withInventory].sort((a, b) => netFilamentGrams(b) - netFilamentGrams(a)).slice(0, 3);
  const totalGrams = withInventory.reduce((s, c) => s + Math.max(0, netFilamentGrams(c)), 0);

  return (
    <Link
      to="/filament"
      className="card block hover:shadow-lg transition-shadow hover:border-[#e68a00] border border-transparent"
      style={{ textDecoration: 'none' }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#ff9900' }}>Filament</h2>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-bold" style={{ color: '#ff9900' }}>{(totalGrams / 1000).toFixed(2)}</span>
        <span className="text-sm text-white mb-1">kg on hand</span>
      </div>

      {critical.length > 0 && (
        <div
          className="flex items-center justify-between py-1 px-2 rounded mb-1 text-xs font-semibold"
          style={{ background: '#dc2626', color: '#ffffff' }}
        >
          <span>⚠ Critical</span>
          <span>{critical.length} color{critical.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      {low.length > 0 && (
        <div
          className="flex items-center justify-between py-1 px-2 rounded mb-1 text-xs font-semibold"
          style={{ background: '#eab308', color: '#000000' }}
        >
          <span>Low Stock</span>
          <span>{low.length} color{low.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mt-2 space-y-1">
          {sorted.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <span
                style={{ width: 10, height: 10, borderRadius: '50%', background: c.hex, flexShrink: 0, display: 'inline-block', border: `1px solid ${c.hex}` }}
              />
              <span className="text-white truncate flex-1">{c.name}</span>
              <span className="text-white shrink-0">{Math.max(0, netFilamentGrams(c)).toFixed(0)}g</span>
            </div>
          ))}
        </div>
      )}

      {withInventory.length === 0 && (
        <p className="text-sm text-white">No inventory tracked yet</p>
      )}

      <p className="text-xs text-white mt-4">View Inventory →</p>
    </Link>
  );
}

function PrinterSummaryCard({ printer, status }: { printer: Printer; status: PrinterLiveStatus | null }) {
  const hasBambuConfig = !!(printer.ipAddress && printer.serialNumber);
  const style = status
    ? getPrinterStatusStyle(status)
    : !hasBambuConfig
      ? { label: 'No Config', bg: '#4b5563', text: '#ffffff' }
      : { label: 'Connecting…', bg: '#6b7280', text: '#ffffff' };

  const isRunning = status?.gcodeState === 'RUNNING';
  const isPaused  = status?.gcodeState === 'PAUSE';

  return (
    <div className="card flex flex-col gap-2" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between gap-2">
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold truncate"
          style={{ background: printer.badgeColor || '#4b5563', color: '#ffffff' }}
        >
          {printer.name}
        </span>
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold shrink-0"
          style={{ background: style.bg, color: style.text }}
        >
          {style.label}
        </span>
      </div>

      {status?.connected && (isRunning || isPaused) ? (
        <>
          {status.subtaskName && (
            <p className="text-xs text-white truncate">{status.subtaskName}</p>
          )}
          <div className="w-full rounded-full h-1.5" style={{ background: '#2d2d2d' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${status.mcPercent ?? 0}%`,
                background: isRunning ? '#ff9900' : '#eab308',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-white">
            <span>{status.mcPercent !== null ? `${status.mcPercent}%` : '—'}</span>
            <span>⏱ {formatTimeRemaining(status.mcRemainingTime)}</span>
          </div>
          <div className="flex gap-3 text-xs text-white pt-0.5">
            {status.nozzleTemper !== null && (
              <span>🔥 {status.nozzleTemper.toFixed(0)}°C</span>
            )}
            {status.bedTemper !== null && (
              <span>⬛ {status.bedTemper.toFixed(0)}°C</span>
            )}
          </div>
        </>
      ) : status?.connected ? (
        <p className="text-xs text-white">
          {status.nozzleTemper !== null ? `Nozzle ${status.nozzleTemper.toFixed(0)}°C` : 'Idle'}
        </p>
      ) : (
        <p className="text-xs text-white">
          {!hasBambuConfig ? 'Configure in Admin → Printers' : 'Waiting for MQTT…'}
        </p>
      )}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: '#ffffff', bg: '#6b7280',  label: 'Draft' },
  sent:      { color: '#ffffff', bg: '#1d4ed8',  label: 'Sent' },
  paid:      { color: '#ffffff', bg: '#15803d',  label: 'Paid' },
  shipped:   { color: '#ffffff', bg: '#6d28d9',  label: 'Shipped' },
  cancelled: { color: '#ffffff', bg: '#b91c1c',  label: 'Cancelled' },
};

export const Dashboard: React.FC = () => {
  const { items: queueItems, isLoading: queueLoading } = useQueue();
  const { invoices, isLoading: invoicesLoading } = useSalesInvoices();
  const { products, isLoading: productsLoading } = useProducts();
  const { colors, isLoading: colorsLoading } = useColors();
  const { printers } = usePrinters();
  const { liveStatuses } = usePrinterDashboard();

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

  const neededColorIds = new Set(
    queueItems
      .filter((i) => i.status === 'pending' || i.status === 'printing')
      .flatMap((i) => (i.colors || []).map((c) => c.colorId))
  );

  const activeProducts = products.filter((p) => p.active).length;
  const recentInvoices = invoices.slice(0, 5);
  const isLoading = queueLoading || invoicesLoading || productsLoading || colorsLoading;

  const activePrinters = printers.filter((p) => p.active);
  const statusById = Object.fromEntries(liveStatuses.map((s) => [s.printerId, s]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-white">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PageIcon src="/icons/dashboard.png" alt="Dashboard" />
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white mt-1">Business overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Print Queue */}
        <StatCard title="Print Queue" to="/queue">
          <div className="divide-y divide-[#2d2d2d]">
            <Pill
              label={`Pending${pendingQty !== pending ? ` (${pendingQty} pcs)` : ''}`}
              count={pending}
              color="#ffffff"
              bg="#6b7280"
            />
            <Pill
              label={`Printing${printingQty !== printing ? ` (${printingQty} pcs)` : ''}`}
              count={printing}
              color="#0a0a0a"
              bg="#ff9900"
            />
          </div>
          {queueItems.length === 0 && (
            <p className="text-sm text-white mt-2">Queue is empty</p>
          )}
        </StatCard>

        {/* Invoices */}
        <StatCard title="Invoices" to="/invoices">
          <div className="divide-y divide-[#2d2d2d]">
            <Pill label="Draft"    count={draft}     color="#ffffff" bg="#6b7280" />
            <Pill label="Sent"     count={sent}      color="#ffffff" bg="#1d4ed8" />
            <Pill label="Shipped"  count={shipped}   color="#ffffff" bg="#6d28d9" />
            <Pill label="Paid"     count={paid}      color="#ffffff" bg="#15803d" />
            {cancelled > 0 && (
              <Pill label="Cancelled" count={cancelled} color="#ffffff" bg="#b91c1c" />
            )}
          </div>
          {invoices.length === 0 && (
            <p className="text-sm text-white mt-2">No invoices yet</p>
          )}
          {(paidRevenue > 0 || outstanding > 0 || thisMonthRevenue > 0) && (
            <div className="mt-3 pt-3 border-t border-[#2d2d2d] space-y-1">
              {thisMonthRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>This Month</span>
                  <span className="text-sm font-semibold" style={{ color: '#ff9900' }}>{fmt(thisMonthRevenue)}</span>
                </div>
              )}
              {paidRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>Total Paid</span>
                  <span className="text-sm font-semibold" style={{ color: '#86efac' }}>{fmt(paidRevenue)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>Outstanding</span>
                  <span className="text-sm font-semibold" style={{ color: '#93c5fd' }}>{fmt(outstanding)}</span>
                </div>
              )}
            </div>
          )}
        </StatCard>

        {/* Filament */}
        <FilamentCard colors={colors} neededColorIds={neededColorIds} />

        {/* Products */}
        <StatCard title="Products" to="/products">
          <div className="flex items-end gap-2 mt-2">
            <span className="text-5xl font-bold" style={{ color: '#ff9900' }}>{activeProducts}</span>
            <span className="text-sm text-white mb-2">active</span>
          </div>
          {products.length > activeProducts && (
            <p className="text-xs text-white mt-1">{products.length - activeProducts} inactive</p>
          )}
        </StatCard>
      </div>

      {/* Printers */}
      {activePrinters.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#ff9900' }}>Printers</h2>
            <Link to="/printers" className="text-xs" style={{ color: '#ff9900' }}>View all →</Link>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {activePrinters.map((printer) => (
              <PrinterSummaryCard
                key={printer.id}
                printer={printer}
                status={statusById[printer.id] ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <div className="card-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d2d2d]">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#ff9900' }}>Recent Invoices</h2>
            <Link to="/invoices" className="text-xs" style={{ color: '#ff9900' }}>View all →</Link>
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
                      <Link to={`/invoices/${inv.id}`} className="font-mono text-sm hover:underline" style={{ color: '#ff9900' }}>
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-white">
                      {inv.customer ? (inv.customer.businessName || inv.customer.contactName) : '—'}
                    </td>
                    <td className="text-white text-sm">{fmtDate(inv.createdAt)}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: sc.color, background: sc.bg }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="text-right font-medium text-white">{fmt(calcTotal(inv))}</td>
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

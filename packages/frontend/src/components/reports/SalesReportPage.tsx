import { useState } from 'react';
import { reportsApi } from '../../services/api';
import { BarChart2 } from 'lucide-react';

interface ReportRow {
  id: number;
  invoiceNumber: string;
  issuedDate: string;
  customerName: string;
  status: string;
  taxExempt: boolean;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
}

interface ReportData {
  startDate: string;
  endDate: string;
  invoiceCount: number;
  totalSubtotal: number;
  taxableSubtotal: number;
  taxExemptSubtotal: number;
  totalShipping: number;
  totalTax: number;
  grandTotal: number;
  rows: ReportRow[];
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const statusColors: Record<string, { bg: string; color: string }> = {
  paid:     { bg: '#15803d', color: '#fff' },
  sent:     { bg: '#1d4ed8', color: '#fff' },
  shipped:  { bg: '#6d28d9', color: '#fff' },
  draft:    { bg: '#6b7280', color: '#fff' },
  cancelled:{ bg: '#b91c1c', color: '#fff' },
};

function StatusPill({ status }: { status: string }) {
  const s = statusColors[status] || { bg: '#4b5563', color: '#fff' };
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Default to current month
function defaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(start), end: fmt(end) };
}

export function SalesReportPage() {
  const defaults = defaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputSt = {
    background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
    border: 'none',
    boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
  };

  async function handleGenerate() {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.getSalesReport(startDate, endDate) as ReportData;
      setReport(data);
    } catch {
      setError('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!startDate || !endDate) return;
    setDownloading(true);
    setError(null);
    try {
      await reportsApi.downloadSalesReportPdf(startDate, endDate);
    } catch {
      setError('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 size={40} style={{ color: '#ff9900', flexShrink: 0 }} />
          <h1 className="text-xl font-bold text-iron-50">Sales Report</h1>
        </div>
      </div>

      {/* Date range picker */}
      <div className="card space-y-4">
        <h2 className="font-semibold" style={{ color: '#ff9900' }}>Date Range</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={inputSt}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#ff9900' }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={inputSt}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
            className="btn-primary btn-sm"
          >
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
          {report && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-secondary btn-sm"
            >
              {downloading ? 'Downloading…' : '↓ Download PDF'}
            </button>
          )}
        </div>
        <p className="text-xs" style={{ color: '#6b7280' }}>
          Includes sent, paid, and shipped invoices only. Draft and cancelled invoices are excluded.
        </p>
        {error && <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
      </div>

      {/* Summary cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Invoices', value: String(report.invoiceCount), accent: false },
              { label: 'Gross Sales', value: fmt(report.totalSubtotal), accent: false },
              { label: 'Sales Tax Collected', value: fmt(report.totalTax), accent: false },
              { label: 'Grand Total', value: fmt(report.grandTotal), accent: true },
            ].map((c) => (
              <div key={c.label} className="card py-3 px-4 flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide font-medium" style={{ color: '#ff9900' }}>{c.label}</span>
                <span className="text-xl font-bold" style={{ color: c.accent ? '#ff9900' : '#ffffff' }}>
                  {c.value}
                </span>
              </div>
            ))}
          </div>

          {/* Taxable / Tax-Exempt breakdown */}
          <div className="card py-3 px-4 space-y-1">
            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: '#ff9900' }}>Sales Breakdown</span>
            <div className="flex flex-wrap gap-6 mt-1">
              <div>
                <span className="text-xs" style={{ color: '#ff9900' }}>Taxable Sales</span>
                <div className="text-base font-semibold text-white font-mono">{fmt(report.taxableSubtotal)}</div>
              </div>
              <div>
                <span className="text-xs" style={{ color: '#ff9900' }}>Tax-Exempt Sales</span>
                <div className="text-base font-semibold text-white font-mono">{fmt(report.taxExemptSubtotal)}</div>
              </div>
              {report.totalShipping > 0 && (
                <div>
                  <span className="text-xs" style={{ color: '#ff9900' }}>Shipping Collected</span>
                  <div className="text-base font-semibold text-white font-mono">{fmt(report.totalShipping)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice table */}
          {report.invoiceCount === 0 ? (
            <div className="card text-center py-10 text-white">
              No sent, paid, or shipped invoices found in this date range.
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="wiz-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Invoice #</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Customer</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Subtotal</th>
                      <th className="text-right hidden sm:table-cell">Shipping</th>
                      <th className="text-right hidden sm:table-cell">Tax</th>
                      <th className="text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-mono text-sm text-white">{row.invoiceNumber}</td>
                        <td className="text-sm text-white whitespace-nowrap">{fmtDate(row.issuedDate)}</td>
                        <td className="text-sm text-white">{row.customerName}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusPill status={row.status} />
                            {row.taxExempt && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: '#4b5563', color: '#fff' }}>TE</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right text-sm text-white font-mono">{fmt(row.subtotal)}</td>
                        <td className="text-right text-sm text-white font-mono hidden sm:table-cell">
                          {row.shippingCost > 0 ? fmt(row.shippingCost) : '—'}
                        </td>
                        <td className="text-right text-sm text-white font-mono hidden sm:table-cell">
                          {row.taxAmount > 0 ? fmt(row.taxAmount) : '—'}
                        </td>
                        <td className="text-right text-sm font-bold font-mono text-white">
                          {fmt(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #4a4a4a', background: 'linear-gradient(to bottom, #3a3a3a, #2d2d2d)' }}>
                      <td colSpan={3} className="text-sm font-bold text-white">
                        {report.invoiceCount} invoice{report.invoiceCount !== 1 ? 's' : ''}
                      </td>
                      <td />
                      <td className="text-right text-sm font-bold font-mono text-white">{fmt(report.totalSubtotal)}</td>
                      <td className="text-right text-sm font-bold font-mono text-white hidden sm:table-cell">
                        {report.totalShipping > 0 ? fmt(report.totalShipping) : '—'}
                      </td>
                      <td className="text-right text-sm font-bold font-mono text-white hidden sm:table-cell">
                        {report.totalTax > 0 ? fmt(report.totalTax) : '—'}
                      </td>
                      <td className="text-right text-sm font-bold font-mono" style={{ color: '#ff9900' }}>{fmt(report.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

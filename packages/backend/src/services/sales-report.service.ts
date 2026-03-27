import { pool } from '../config/database.js';

export interface SalesReportRow {
  id: number;
  invoiceNumber: string;
  issuedDate: Date;
  customerName: string;
  status: string;
  taxExempt: boolean;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
}

export interface SalesReportSummary {
  startDate: string;
  endDate: string;
  invoiceCount: number;
  totalSubtotal: number;
  taxableSubtotal: number;
  taxExemptSubtotal: number;
  totalShipping: number;
  totalTax: number;
  grandTotal: number;
  rows: SalesReportRow[];
}

export async function getSalesReport(startDate: string, endDate: string): Promise<SalesReportSummary> {
  const result = await pool.query(`
    SELECT
      si.id,
      si.invoice_number,
      si.created_at AS issued_date,
      si.status,
      si.tax_rate,
      si.tax_exempt,
      si.shipping_cost,
      COALESCE(c.contact_name, c.business_name, 'Walk-in') AS customer_name,
      COALESCE(SUM(li.quantity * li.unit_price), 0) AS subtotal
    FROM sales_invoices si
    LEFT JOIN customers c ON si.customer_id = c.id
    LEFT JOIN invoice_line_items li ON li.invoice_id = si.id
    WHERE si.status IN ('sent', 'paid', 'shipped')
      AND si.created_at::date >= $1::date
      AND si.created_at::date <= $2::date
    GROUP BY si.id, si.invoice_number, si.created_at, si.status,
             si.tax_rate, si.tax_exempt, si.shipping_cost, c.contact_name, c.business_name
    ORDER BY si.created_at ASC, si.invoice_number ASC
  `, [startDate, endDate]);

  const rows: SalesReportRow[] = result.rows.map((row: Record<string, unknown>) => {
    const subtotal = parseFloat(row.subtotal as string) || 0;
    const shippingCost = parseFloat(row.shipping_cost as string) || 0;
    const taxExempt = row.tax_exempt as boolean;
    const taxAmount = taxExempt ? 0 : subtotal * parseFloat(row.tax_rate as string);
    const total = subtotal + shippingCost + taxAmount;
    return {
      id: row.id as number,
      invoiceNumber: row.invoice_number as string,
      issuedDate: row.issued_date as Date,
      customerName: row.customer_name as string,
      status: row.status as string,
      taxExempt,
      subtotal,
      shippingCost,
      taxAmount,
      total,
    };
  });

  const taxableSubtotal = rows.filter(r => !r.taxExempt).reduce((s, r) => s + r.subtotal, 0);
  const taxExemptSubtotal = rows.filter(r => r.taxExempt).reduce((s, r) => s + r.subtotal, 0);

  return {
    startDate,
    endDate,
    invoiceCount: rows.length,
    totalSubtotal: rows.reduce((s, r) => s + r.subtotal, 0),
    taxableSubtotal,
    taxExemptSubtotal,
    totalShipping: rows.reduce((s, r) => s + r.shippingCost, 0),
    totalTax: rows.reduce((s, r) => s + r.taxAmount, 0),
    grandTotal: rows.reduce((s, r) => s + r.total, 0),
    rows,
  };
}

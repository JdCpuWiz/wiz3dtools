import PDFDocument from 'pdfkit';
import type { SalesInvoice, InvoiceLineItem } from '@wizqueue/shared';

const ORANGE = '#E8610A';
const DARK = '#1a1a1a';
const LIGHT_GRAY = '#f5f5f5';
const MID_GRAY = '#cccccc';

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function calcTotals(invoice: SalesInvoice): { subtotal: number; shippingCost: number; taxAmount: number; total: number } {
  const subtotal = invoice.lineItems.reduce((sum: number, li: InvoiceLineItem) => sum + li.quantity * li.unitPrice, 0);
  const shippingCost = invoice.shippingCost || 0;
  const taxAmount = invoice.taxExempt ? 0 : subtotal * invoice.taxRate;
  const total = subtotal + shippingCost + taxAmount;
  return { subtotal, shippingCost, taxAmount, total };
}

export async function generateInvoicePdf(invoice: SalesInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const companyName = process.env.COMPANY_NAME || 'Wiz3D Prints';
    const companyEmail = process.env.COMPANY_EMAIL || '';
    const companyPhone = process.env.COMPANY_PHONE || '';
    const companyAddress = process.env.COMPANY_ADDRESS || '';

    // ── Header ──────────────────────────────────────────────────────────
    doc.fillColor(ORANGE).fontSize(24).font('Helvetica-Bold').text(companyName, 50, 50);
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    let y = 80;
    if (companyEmail) { doc.text(companyEmail, 50, y); y += 14; }
    if (companyPhone) { doc.text(companyPhone, 50, y); y += 14; }
    if (companyAddress) { doc.text(companyAddress, 50, y); y += 14; }

    // Invoice title + number (right aligned)
    doc.fillColor(DARK).fontSize(28).font('Helvetica-Bold').text('INVOICE', 350, 50, { align: 'right', width: 195 });
    doc.fontSize(11).font('Helvetica').fillColor(ORANGE)
      .text(invoice.invoiceNumber, 350, 85, { align: 'right', width: 195 });

    // Status badge
    const statusColors: Record<string, string> = {
      draft: '#888888',
      sent: '#3b82f6',
      paid: '#22c55e',
      cancelled: '#ef4444',
    };
    doc.fillColor(statusColors[invoice.status] || DARK).fontSize(10)
      .text(invoice.status.toUpperCase(), 350, 105, { align: 'right', width: 195 });

    // Dates
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    const issueDate = new Date(invoice.createdAt).toLocaleDateString('en-NZ');
    doc.text(`Issue Date: ${issueDate}`, 350, 125, { align: 'right', width: 195 });
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate).toLocaleDateString('en-NZ');
      doc.text(`Due Date: ${due}`, 350, 139, { align: 'right', width: 195 });
    }

    // ── Divider ──────────────────────────────────────────────────────────
    const dividerY = Math.max(y + 10, 165);
    doc.moveTo(50, dividerY).lineTo(545, dividerY).lineWidth(1.5).strokeColor(ORANGE).stroke();

    // ── Bill To ──────────────────────────────────────────────────────────
    let billY = dividerY + 15;
    doc.fillColor(ORANGE).fontSize(10).font('Helvetica-Bold').text('BILL TO', 50, billY);
    billY += 16;
    doc.fillColor(DARK).font('Helvetica').fontSize(10);

    const customer = invoice.customer;
    if (customer) {
      if (customer.businessName) { doc.text(customer.businessName, 50, billY); billY += 14; }
      doc.text(customer.contactName, 50, billY); billY += 14;
      if (customer.email) { doc.text(customer.email, 50, billY); billY += 14; }
      if (customer.phone) { doc.text(customer.phone, 50, billY); billY += 14; }
      const addrParts = [customer.addressLine1, customer.addressLine2, customer.city, customer.stateProvince, customer.postalCode, customer.country].filter(Boolean);
      if (addrParts.length) { doc.text(addrParts.join(', '), 50, billY, { width: 250 }); }
    } else {
      doc.text('N/A', 50, billY);
    }

    // ── Line Items Table ─────────────────────────────────────────────────
    const tableY = Math.max(billY + 40, dividerY + 120);
    const colX = { product: 50, details: 170, qty: 330, price: 390, subtotal: 470 };

    // Table header
    doc.fillColor(ORANGE).rect(50, tableY, 495, 22).fill();
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('PRODUCT', colX.product + 4, tableY + 6);
    doc.text('DETAILS', colX.details + 4, tableY + 6);
    doc.text('QTY', colX.qty + 4, tableY + 6);
    doc.text('UNIT PRICE', colX.price + 4, tableY + 6);
    doc.text('SUBTOTAL', colX.subtotal + 4, tableY + 6);

    // Rows
    let rowY = tableY + 22;
    doc.font('Helvetica').fontSize(9).fillColor(DARK);

    invoice.lineItems.forEach((item: InvoiceLineItem, idx: number) => {
      const rowHeight = 22;
      if (idx % 2 === 0) {
        doc.fillColor(LIGHT_GRAY).rect(50, rowY, 495, rowHeight).fill();
      }
      doc.fillColor(DARK);
      const itemSubtotal = item.quantity * item.unitPrice;
      doc.text(item.productName, colX.product + 4, rowY + 7, { width: 115, ellipsis: true });
      doc.text(item.details || '', colX.details + 4, rowY + 7, { width: 155, ellipsis: true });
      doc.text(String(item.quantity), colX.qty + 4, rowY + 7, { width: 55 });
      doc.text(formatCurrency(item.unitPrice), colX.price + 4, rowY + 7, { width: 75 });
      doc.text(formatCurrency(itemSubtotal), colX.subtotal + 4, rowY + 7, { width: 70 });
      rowY += rowHeight;
    });

    // Bottom border of table
    doc.moveTo(50, rowY).lineTo(545, rowY).lineWidth(0.5).strokeColor(MID_GRAY).stroke();

    // ── Totals ───────────────────────────────────────────────────────────
    const { subtotal, shippingCost, taxAmount, total } = calcTotals(invoice);
    const totalsX = 360;
    rowY += 12;

    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    doc.text('Subtotal:', totalsX, rowY, { width: 95 });
    doc.text(formatCurrency(subtotal), totalsX + 100, rowY, { width: 75, align: 'right' });
    rowY += 16;

    if (shippingCost > 0) {
      doc.text('Shipping:', totalsX, rowY, { width: 95 });
      doc.text(formatCurrency(shippingCost), totalsX + 100, rowY, { width: 75, align: 'right' });
      rowY += 16;
    }

    if (!invoice.taxExempt) {
      doc.text(`IA Sales Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, totalsX, rowY, { width: 95 });
      doc.text(formatCurrency(taxAmount), totalsX + 100, rowY, { width: 75, align: 'right' });
      rowY += 16;
    } else {
      doc.text('Tax Exempt', totalsX, rowY, { width: 175 });
      rowY += 16;
    }

    // Total box
    doc.fillColor(ORANGE).rect(totalsX - 5, rowY, 180, 24).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', totalsX, rowY + 6, { width: 95 });
    doc.text(formatCurrency(total), totalsX + 100, rowY + 6, { width: 75, align: 'right' });

    // ── Notes ────────────────────────────────────────────────────────────
    if (invoice.notes) {
      rowY += 45;
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('NOTES', 50, rowY);
      rowY += 14;
      doc.fillColor(DARK).font('Helvetica').text(invoice.notes, 50, rowY, { width: 495 });
    }

    doc.end();
  });
}

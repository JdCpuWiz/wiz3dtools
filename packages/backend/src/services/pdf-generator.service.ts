import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { SalesInvoice, InvoiceLineItem } from '@wizqueue/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '../assets/wiz3d_logo.png');

const ORANGE = '#E8610A';
const DARK = '#1a1a1a';
const LIGHT_GRAY = '#f5f5f5';
const MID_GRAY = '#cccccc';
const SHADE_BOX = '#1e1e1e';

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
    // Logo top-left (1024:1167 aspect → 50×57px)
    const LOGO_W = 50;
    const LOGO_H = 57;
    let logoLoaded = false;
    try {
      doc.image(LOGO_PATH, 50, 45, { width: LOGO_W, height: LOGO_H });
      logoLoaded = true;
    } catch {
      // logo missing — fall back to text-only header
    }

    // Company name + contact — right of logo if loaded, else at x=50
    const textX = logoLoaded ? 50 + LOGO_W + 10 : 50;
    doc.fillColor(ORANGE).fontSize(20).font('Helvetica-Bold').text(companyName, textX, 47);
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    let companyY = 71;
    if (companyEmail) { doc.text(companyEmail, textX, companyY); companyY += 13; }
    if (companyPhone) { doc.text(companyPhone, textX, companyY); companyY += 13; }
    if (companyAddress) { doc.text(companyAddress, textX, companyY); companyY += 13; }

    // Invoice title + number (right aligned)
    doc.fillColor(DARK).fontSize(28).font('Helvetica-Bold').text('INVOICE', 350, 45, { align: 'right', width: 195 });
    doc.fontSize(11).font('Helvetica').fillColor(ORANGE)
      .text(invoice.invoiceNumber, 350, 80, { align: 'right', width: 195 });

    // Status badge
    const statusColors: Record<string, string> = {
      draft: '#888888',
      sent: '#3b82f6',
      paid: '#22c55e',
      cancelled: '#ef4444',
    };
    doc.fillColor(statusColors[invoice.status] || DARK).fontSize(10)
      .text(invoice.status.toUpperCase(), 350, 97, { align: 'right', width: 195 });

    // Dates
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    const issueDate = new Date(invoice.createdAt).toLocaleDateString('en-NZ');
    doc.text(`Issue Date: ${issueDate}`, 350, 117, { align: 'right', width: 195 });
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate).toLocaleDateString('en-NZ');
      doc.text(`Due Date: ${due}`, 350, 131, { align: 'right', width: 195 });
    }

    // ── Divider ──────────────────────────────────────────────────────────
    const headerBottom = Math.max(companyY, logoLoaded ? 45 + LOGO_H : 0, 150);
    const dividerY = headerBottom + 8;
    doc.moveTo(50, dividerY).lineTo(545, dividerY).lineWidth(1.5).strokeColor(ORANGE).stroke();

    // ── Bill To (shaded box) ─────────────────────────────────────────────
    const billBoxTop = dividerY + 12;

    // Measure content height first
    const customer = invoice.customer;
    const billLines: string[] = [];
    if (customer) {
      if (customer.businessName) billLines.push(customer.businessName);
      billLines.push(customer.contactName);
      if (customer.email) billLines.push(customer.email);
      if (customer.phone) billLines.push(customer.phone);
      const addrParts = [customer.addressLine1, customer.addressLine2, customer.city, customer.stateProvince, customer.postalCode, customer.country].filter(Boolean);
      if (addrParts.length) billLines.push(addrParts.join(', '));
    } else {
      billLines.push('N/A');
    }

    const billBoxH = 16 + billLines.length * 14 + 10;
    doc.roundedRect(50, billBoxTop, 250, billBoxH, 6).fill(SHADE_BOX);

    let billY = billBoxTop + 10;
    doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('BILL TO', 62, billY);
    billY += 15;
    doc.fillColor('#e5e5e5').font('Helvetica').fontSize(9);
    for (const line of billLines) {
      doc.text(line, 62, billY, { width: 226 });
      billY += 14;
    }

    // ── Line Items Table ─────────────────────────────────────────────────
    const tableY = billBoxTop + billBoxH + 18;
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

    // ── Totals (shaded box) ───────────────────────────────────────────────
    const { subtotal, shippingCost, taxAmount, total } = calcTotals(invoice);

    // Calculate totals box height
    let totalsLines = 1; // subtotal always
    if (shippingCost > 0) totalsLines++;
    totalsLines++; // tax or exempt
    const totalsBoxH = totalsLines * 18 + 12 + 28; // rows + padding + total row
    const totalsBoxTop = rowY + 10;
    const totalsBoxX = 340;
    const totalsBoxW = 205;

    doc.roundedRect(totalsBoxX, totalsBoxTop, totalsBoxW, totalsBoxH, 6).fill(SHADE_BOX);

    let tY = totalsBoxTop + 10;
    const labelX = totalsBoxX + 8;
    const valueX = totalsBoxX + 110;
    const valueW = totalsBoxW - 118;

    doc.fillColor('#d1d5db').fontSize(9).font('Helvetica');
    doc.text('Subtotal:', labelX, tY, { width: 100 });
    doc.text(formatCurrency(subtotal), valueX, tY, { width: valueW, align: 'right' });
    tY += 18;

    if (shippingCost > 0) {
      doc.text('Shipping:', labelX, tY, { width: 100 });
      doc.text(formatCurrency(shippingCost), valueX, tY, { width: valueW, align: 'right' });
      tY += 18;
    }

    if (!invoice.taxExempt) {
      doc.text(`IA Sales Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, labelX, tY, { width: 100 });
      doc.text(formatCurrency(taxAmount), valueX, tY, { width: valueW, align: 'right' });
      tY += 18;
    } else {
      doc.text('Tax Exempt', labelX, tY, { width: totalsBoxW - 16 });
      tY += 18;
    }

    // Total row inside shaded box
    doc.fillColor(ORANGE).roundedRect(totalsBoxX + 4, tY + 2, totalsBoxW - 8, 22, 4).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', labelX, tY + 7, { width: 100 });
    doc.text(formatCurrency(total), valueX, tY + 7, { width: valueW, align: 'right' });

    rowY = totalsBoxTop + totalsBoxH + 12;

    // ── Notes (shaded box) ───────────────────────────────────────────────
    if (invoice.notes) {
      const notesBoxH = 14 + 16 + 14 + 10; // label + text estimate + padding
      doc.roundedRect(50, rowY, 495, notesBoxH, 6).fill(SHADE_BOX);
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('NOTES', 62, rowY + 10);
      doc.fillColor('#d1d5db').font('Helvetica').text(invoice.notes, 62, rowY + 24, { width: 471 });
    }

    doc.end();
  });
}

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
const BOX_BG = '#f0f0f0';   // soft light grey for all section boxes
const BOX_PAD = 8;

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateInput: Date | string): string {
  return new Date(dateInput).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
    const companyWebsite = process.env.COMPANY_WEBSITE || '';
    const paymentPaypal = process.env.PAYMENT_PAYPAL || '';
    const paymentVenmo = process.env.PAYMENT_VENMO || '';

    // ── Company Info Box (top-left, light grey) ────────────────────────────
    const LOGO_W = 50;
    const LOGO_H = 57;

    const companyInfoLines: string[] = [];
    if (companyEmail) companyInfoLines.push(companyEmail);
    if (companyPhone) companyInfoLines.push(companyPhone);
    if (companyAddress) companyInfoLines.push(companyAddress);

    // Calculate box height from content
    const infoBlockH = 22 + companyInfoLines.length * 13; // name(22px) + info lines
    const contentH = Math.max(LOGO_H, infoBlockH);
    const COMPANY_BOX_X = 42;
    const COMPANY_BOX_TOP = 38;
    const COMPANY_BOX_W = 290;
    const COMPANY_BOX_H = BOX_PAD + contentH + BOX_PAD;

    // Draw box background first, then overlay logo and text
    doc.roundedRect(COMPANY_BOX_X, COMPANY_BOX_TOP, COMPANY_BOX_W, COMPANY_BOX_H, 6).fill(BOX_BG);

    const logoX = COMPANY_BOX_X + BOX_PAD;
    const logoY = COMPANY_BOX_TOP + BOX_PAD;
    const textX = logoX + LOGO_W + 10;

    try {
      doc.image(LOGO_PATH, logoX, logoY, { width: LOGO_W, height: LOGO_H });
    } catch {
      // logo missing — skip
    }

    doc.fillColor(ORANGE).fontSize(18).font('Helvetica-Bold').text(companyName, textX, logoY + 2);
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    let infoY = logoY + 24;
    for (const line of companyInfoLines) {
      doc.text(line, textX, infoY, { width: COMPANY_BOX_W - (textX - COMPANY_BOX_X) - BOX_PAD });
      infoY += 13;
    }

    // ── Invoice title + number (right aligned) ─────────────────────────────
    const INV_X = 350;
    const INV_W = 195;
    doc.fillColor(DARK).fontSize(28).font('Helvetica-Bold')
      .text('INVOICE', INV_X, COMPANY_BOX_TOP, { align: 'right', width: INV_W });
    doc.fontSize(11).font('Helvetica').fillColor(ORANGE)
      .text(invoice.invoiceNumber, INV_X, COMPANY_BOX_TOP + 35, { align: 'right', width: INV_W });

    const statusColors: Record<string, string> = {
      draft: '#888888',
      sent: '#3b82f6',
      paid: '#22c55e',
      cancelled: '#ef4444',
    };
    doc.fillColor(statusColors[invoice.status] || DARK).fontSize(10)
      .text(invoice.status.toUpperCase(), INV_X, COMPANY_BOX_TOP + 52, { align: 'right', width: INV_W });

    // Date fields: right-align label column so colons line up, left-align value
    const DATE_LABEL_W = 68;
    const DATE_VAL_X = INV_X + DATE_LABEL_W + 4;
    const DATE_VAL_W = INV_W - DATE_LABEL_W - 4;
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    doc.text('Issue Date:', INV_X, COMPANY_BOX_TOP + 70, { width: DATE_LABEL_W, align: 'right' });
    doc.text(formatDate(invoice.createdAt), DATE_VAL_X, COMPANY_BOX_TOP + 70, { width: DATE_VAL_W });
    if (invoice.dueDate) {
      doc.text('Due Date:', INV_X, COMPANY_BOX_TOP + 83, { width: DATE_LABEL_W, align: 'right' });
      doc.text(formatDate(invoice.dueDate), DATE_VAL_X, COMPANY_BOX_TOP + 83, { width: DATE_VAL_W });
    }

    // ── Divider ────────────────────────────────────────────────────────────
    const dividerY = Math.max(COMPANY_BOX_TOP + COMPANY_BOX_H, 130) + 10;
    doc.moveTo(50, dividerY).lineTo(545, dividerY).lineWidth(1.5).strokeColor(ORANGE).stroke();

    // ── Bill To (light grey box) ───────────────────────────────────────────
    const billBoxTop = dividerY + 12;
    const customer = invoice.customer;
    const billLines: string[] = [];
    if (customer) {
      if (customer.businessName) billLines.push(customer.businessName);
      billLines.push(customer.contactName);
      if (customer.email) billLines.push(customer.email);
      if (customer.phone) billLines.push(customer.phone);
      // country excluded — city/state/zip only
      const addrParts = [customer.addressLine1, customer.addressLine2, customer.city, customer.stateProvince, customer.postalCode].filter(Boolean);
      if (addrParts.length) billLines.push(addrParts.join(', '));
    } else {
      billLines.push('N/A');
    }

    const billBoxH = BOX_PAD + 14 + billLines.length * 14 + BOX_PAD;
    doc.roundedRect(50, billBoxTop, 250, billBoxH, 6).fill(BOX_BG);

    let billY = billBoxTop + BOX_PAD;
    doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('BILL TO', 62, billY);
    billY += 14;
    doc.fillColor(DARK).font('Helvetica').fontSize(9);
    for (const line of billLines) {
      doc.text(line, 62, billY, { width: 226 });
      billY += 14;
    }

    // ── Line Items Table ───────────────────────────────────────────────────
    const tableY = billBoxTop + billBoxH + 18;
    const colX = { product: 50, details: 170, qty: 330, price: 390, subtotal: 470 };

    doc.fillColor(ORANGE).rect(50, tableY, 495, 22).fill();
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('PRODUCT', colX.product + 4, tableY + 6);
    doc.text('DETAILS', colX.details + 4, tableY + 6);
    doc.text('QTY', colX.qty + 4, tableY + 6);
    doc.text('UNIT PRICE', colX.price + 4, tableY + 6);
    doc.text('SUBTOTAL', colX.subtotal + 4, tableY + 6);

    let rowY = tableY + 22;
    doc.font('Helvetica').fontSize(9).fillColor(DARK);

    invoice.lineItems.forEach((item: InvoiceLineItem, idx: number) => {
      const rowHeight = item.sku ? 34 : 22;
      if (idx % 2 === 0) {
        doc.fillColor(LIGHT_GRAY).rect(50, rowY, 495, rowHeight).fill();
      }
      doc.fillColor(DARK);
      const itemSubtotal = item.quantity * item.unitPrice;
      doc.text(item.productName, colX.product + 4, rowY + 7, { width: 115, ellipsis: true });
      if (item.sku) {
        doc.fillColor('#888888').fontSize(8).text(item.sku, colX.product + 4, rowY + 18, { width: 115, ellipsis: true });
        doc.fillColor(DARK).fontSize(9);
      }
      doc.text(item.details || '', colX.details + 4, rowY + 7, { width: 155, ellipsis: true });
      doc.text(String(item.quantity), colX.qty + 4, rowY + 7, { width: 55 });
      doc.text(formatCurrency(item.unitPrice), colX.price + 4, rowY + 7, { width: 75 });
      doc.text(formatCurrency(itemSubtotal), colX.subtotal + 4, rowY + 7, { width: 70 });
      rowY += rowHeight;
    });

    doc.moveTo(50, rowY).lineTo(545, rowY).lineWidth(0.5).strokeColor(MID_GRAY).stroke();

    // ── Totals (light grey box) ────────────────────────────────────────────
    const { subtotal, shippingCost, taxAmount, total } = calcTotals(invoice);

    let totalsRows = 1; // subtotal
    if (shippingCost > 0) totalsRows++;
    totalsRows++; // tax or exempt

    const totalsBoxTop = rowY + 10;
    const totalsBoxX = 340;
    const totalsBoxW = 205;
    const totalsBoxH = BOX_PAD + totalsRows * 18 + 6 + 26 + BOX_PAD; // pad + rows + gap + total row + pad

    doc.roundedRect(totalsBoxX, totalsBoxTop, totalsBoxW, totalsBoxH, 6).fill(BOX_BG);

    let tY = totalsBoxTop + BOX_PAD;
    const labelX = totalsBoxX + 8;
    const valueX = totalsBoxX + 105;
    const valueW = totalsBoxW - 113;

    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    doc.text('Subtotal:', labelX, tY, { width: 95 });
    doc.text(formatCurrency(subtotal), valueX, tY, { width: valueW, align: 'right' });
    tY += 18;

    if (shippingCost > 0) {
      doc.text('Shipping:', labelX, tY, { width: 95 });
      doc.text(formatCurrency(shippingCost), valueX, tY, { width: valueW, align: 'right' });
      tY += 18;
    }

    if (!invoice.taxExempt) {
      doc.text(`IA Sales Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, labelX, tY, { width: 95 });
      doc.text(formatCurrency(taxAmount), valueX, tY, { width: valueW, align: 'right' });
      tY += 18;
    } else {
      doc.text('Tax Exempt', labelX, tY, { width: totalsBoxW - 16 });
      tY += 18;
    }

    tY += 4;
    doc.fillColor(ORANGE).roundedRect(totalsBoxX + 4, tY, totalsBoxW - 8, 24, 4).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', labelX, tY + 6, { width: 95 });
    doc.text(formatCurrency(total), valueX, tY + 6, { width: valueW, align: 'right' });

    rowY = totalsBoxTop + totalsBoxH + 12;

    // ── Payment Info (light grey box) ──────────────────────────────────────
    const paymentLines: string[] = [];
    if (companyWebsite) paymentLines.push(`Website: ${companyWebsite}`);
    if (paymentPaypal) paymentLines.push(`PayPal: ${paymentPaypal}`);
    if (paymentVenmo) paymentLines.push(`Venmo: ${paymentVenmo}`);

    if (paymentLines.length > 0) {
      const payBoxH = BOX_PAD + 14 + paymentLines.length * 13 + BOX_PAD;
      doc.roundedRect(50, rowY, 495, payBoxH, 6).fill(BOX_BG);
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('PAYMENT', 62, rowY + BOX_PAD);
      doc.fillColor(DARK).font('Helvetica').fontSize(9);
      let pY = rowY + BOX_PAD + 14;
      for (const line of paymentLines) {
        doc.text(line, 62, pY, { width: 471 });
        pY += 13;
      }
      rowY += payBoxH + 8;
    }

    // ── Notes (light grey box) ─────────────────────────────────────────────
    if (invoice.notes) {
      const noteLines = Math.max(1, Math.ceil(invoice.notes.length / 85));
      const notesBoxH = BOX_PAD + 14 + noteLines * 14 + BOX_PAD;
      doc.roundedRect(50, rowY, 495, notesBoxH, 6).fill(BOX_BG);
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('NOTES', 62, rowY + BOX_PAD);
      doc.fillColor(DARK).font('Helvetica').text(invoice.notes, 62, rowY + BOX_PAD + 14, { width: 471 });
    }

    doc.end();
  });
}

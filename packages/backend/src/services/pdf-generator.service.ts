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
    // 1/4" margins: 1pt = 1/72", so 0.25" = 18pt
    const M = 18;          // margin (left & right)
    const R = 595 - M;     // right edge (A4 = 595pt wide)
    const CW = R - M;      // content width = 559pt

    const doc = new PDFDocument({ margin: M, size: 'A4' });
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
    if (companyWebsite) companyInfoLines.push(companyWebsite);

    // Calculate box height from content
    const infoBlockH = 22 + companyInfoLines.length * 13; // name(22px) + info lines
    const contentH = Math.max(LOGO_H, infoBlockH);
    const COMPANY_BOX_X = M - 8;        // 10pt — slightly inside margin
    const COMPANY_BOX_TOP = 12;
    const COMPANY_BOX_W = 318;
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
    const INV_W = 229;
    const INV_X = R - INV_W;   // right-flush to page edge
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
    const dividerY = Math.max(COMPANY_BOX_TOP + COMPANY_BOX_H, 115) + 10;
    doc.moveTo(M, dividerY).lineTo(R, dividerY).lineWidth(1.5).strokeColor(ORANGE).stroke();

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

    const BILL_BOX_W = 270;
    const billBoxH = BOX_PAD + 14 + billLines.length * 14 + BOX_PAD;
    doc.roundedRect(M, billBoxTop, BILL_BOX_W, billBoxH, 6).fill(BOX_BG);

    const billTextX = M + 12;
    let billY = billBoxTop + BOX_PAD;
    doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('BILL TO', billTextX, billY);
    billY += 14;
    doc.fillColor(DARK).font('Helvetica').fontSize(9);
    for (const line of billLines) {
      doc.text(line, billTextX, billY, { width: BILL_BOX_W - 24 });
      billY += 14;
    }

    // ── Line Items Table ───────────────────────────────────────────────────
    const tableY = billBoxTop + billBoxH + 18;
    // Columns — qty/price/subtotal shifted right 20pt for breathing room after details
    const colX = { product: M, details: M + 142, qty: M + 322, price: M + 392, subtotal: M + 472 };
    // Right-aligned column widths (qty/price/subtotal all flush to right of their column)
    const qtyColW      = colX.price    - colX.qty      - 6;
    const priceColW    = colX.subtotal - colX.price    - 6;
    const subtotalColW = R             - colX.subtotal - 6;

    doc.fillColor(ORANGE).rect(M, tableY, CW, 22).fill();
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    doc.text('PRODUCT',    colX.product + 4, tableY + 7);
    doc.text('DETAILS',    colX.details + 4, tableY + 7);
    doc.text('QTY',        colX.qty,         tableY + 7, { align: 'right', width: qtyColW      });
    doc.text('UNIT PRICE', colX.price,       tableY + 7, { align: 'right', width: priceColW    });
    doc.text('SUBTOTAL',   colX.subtotal,    tableY + 7, { align: 'right', width: subtotalColW });

    let rowY = tableY + 22;
    doc.font('Helvetica').fontSize(8).fillColor(DARK);

    // Column content widths for wrapping / height measurement
    const COL_W = {
      product: 133,
      details: colX.qty - colX.details - 10,  // widens as qty shifts right (~170pt)
      qty:      62,
    };
    const VPAD = 10; // top & bottom padding inside each row

    invoice.lineItems.forEach((item: InvoiceLineItem, idx: number) => {
      // ── Measure row height before drawing anything ────────────────────────
      doc.fontSize(8);
      const productH  = doc.heightOfString(item.productName, { width: COL_W.product });
      const detailsH  = item.details ? doc.heightOfString(item.details, { width: COL_W.details }) : 0;

      let skuH = 0;
      if (item.sku) {
        doc.fontSize(7);
        skuH = doc.heightOfString(item.sku, { width: COL_W.product }) + 3; // 3pt gap below product name
        doc.fontSize(8);
      }

      const leftColH   = productH + skuH;
      const rowContent = Math.max(leftColH, detailsH, 12); // minimum 12pt content
      const rowHeight  = Math.ceil(rowContent) + VPAD * 2;

      // ── Draw row background ───────────────────────────────────────────────
      if (idx % 2 === 0) {
        doc.fillColor(LIGHT_GRAY).rect(M, rowY, CW, rowHeight).fill();
      }
      doc.fillColor(DARK);

      const itemSubtotal = item.quantity * item.unitPrice;
      const textTop = rowY + VPAD;
      const clip1 = { lineBreak: false, ellipsis: true, height: 12 }; // single-line columns

      // ── Product name (wraps freely) ───────────────────────────────────────
      doc.fontSize(8);
      doc.text(item.productName, colX.product + 4, textTop, { width: COL_W.product });

      // ── SKU (single line, below product name) ─────────────────────────────
      if (item.sku) {
        doc.fillColor('#888888').fontSize(7)
          .text(item.sku, colX.product + 4, textTop + productH + 3, { ...clip1, height: 10, width: COL_W.product });
        doc.fillColor(DARK).fontSize(8);
      }

      // ── Details (wraps freely) ────────────────────────────────────────────
      if (item.details) {
        doc.text(item.details, colX.details + 4, textTop, { width: COL_W.details });
      }

      // ── Numeric columns (single line, all right-aligned) ──────────────────
      doc.text(String(item.quantity),          colX.qty,      textTop, { ...clip1, width: qtyColW,      align: 'right' });
      doc.text(formatCurrency(item.unitPrice), colX.price,    textTop, { ...clip1, width: priceColW,    align: 'right' });
      doc.text(formatCurrency(itemSubtotal),   colX.subtotal, textTop, { ...clip1, width: subtotalColW, align: 'right' });

      // ── Row separator ─────────────────────────────────────────────────────
      doc.moveTo(M, rowY + rowHeight).lineTo(R, rowY + rowHeight).lineWidth(0.3).strokeColor(MID_GRAY).stroke();
      rowY += rowHeight;
    });

    doc.moveTo(M, rowY).lineTo(R, rowY).lineWidth(0.5).strokeColor(MID_GRAY).stroke();

    // ── Totals (light grey box) ────────────────────────────────────────────
    const { subtotal, shippingCost, taxAmount, total } = calcTotals(invoice);

    let totalsRows = 1; // subtotal
    if (shippingCost > 0) totalsRows++;
    totalsRows++; // tax or exempt

    const totalsBoxTop = rowY + 10;
    const totalsBoxW = 220;
    const totalsBoxX = R - totalsBoxW;
    const totalsBoxH = BOX_PAD + totalsRows * 18 + 6 + 26 + BOX_PAD; // pad + rows + gap + total row + pad

    doc.roundedRect(totalsBoxX, totalsBoxTop, totalsBoxW, totalsBoxH, 6).fill(BOX_BG);

    let tY = totalsBoxTop + BOX_PAD;
    const labelX = totalsBoxX + 8;
    const valueX = totalsBoxX + 110;
    const valueW = totalsBoxW - 118;

    doc.fillColor(DARK).fontSize(9).font('Helvetica');
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

    tY += 4;
    doc.fillColor(ORANGE).roundedRect(totalsBoxX + 4, tY, totalsBoxW - 8, 24, 4).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', labelX, tY + 6, { width: 100 });
    doc.text(formatCurrency(total), valueX, tY + 6, { width: valueW, align: 'right' });

    rowY = totalsBoxTop + totalsBoxH + 12;

    // ── Payment Info (light grey box) ──────────────────────────────────────
    const paymentLines: string[] = [];
    if (paymentPaypal) paymentLines.push(`PayPal: ${paymentPaypal}`);
    if (paymentVenmo) paymentLines.push(`Venmo: ${paymentVenmo}`);

    if (paymentLines.length > 0) {
      const payBoxH = BOX_PAD + 14 + paymentLines.length * 13 + BOX_PAD;
      doc.roundedRect(M, rowY, CW, payBoxH, 6).fill(BOX_BG);
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('PAYMENT', M + 12, rowY + BOX_PAD);
      doc.fillColor(DARK).font('Helvetica').fontSize(9);
      let pY = rowY + BOX_PAD + 14;
      for (const line of paymentLines) {
        doc.text(line, M + 12, pY, { width: CW - 24 });
        pY += 13;
      }
      rowY += payBoxH + 8;
    }

    // ── Notes (light grey box) ─────────────────────────────────────────────
    if (invoice.notes) {
      const noteLines = Math.max(1, Math.ceil(invoice.notes.length / 95));
      const notesBoxH = BOX_PAD + 14 + noteLines * 14 + BOX_PAD;
      doc.roundedRect(M, rowY, CW, notesBoxH, 6).fill(BOX_BG);
      doc.fillColor(ORANGE).fontSize(9).font('Helvetica-Bold').text('NOTES', M + 12, rowY + BOX_PAD);
      doc.fillColor(DARK).font('Helvetica').text(invoice.notes, M + 12, rowY + BOX_PAD + 14, { width: CW - 24 });
    }

    doc.end();
  });
}

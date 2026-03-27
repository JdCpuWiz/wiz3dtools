import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { SalesReportSummary, SalesReportRow } from './sales-report.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '../assets/wiz3d_logo.png');

const ORANGE = '#E8610A';
const DARK = '#1a1a1a';
const LIGHT_GRAY = '#dcdcdc';
const BOX_BG = '#d0d0d0';

function fmt(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusColor(status: string): string {
  switch (status) {
    case 'paid': return '#15803d';
    case 'sent': return '#1d4ed8';
    case 'shipped': return '#6d28d9';
    default: return '#6b7280';
  }
}

export async function generateSalesReportPdf(report: SalesReportSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const M = 18;
    const R = 595 - M;
    const CW = R - M;  // 559pt content width

    const doc = new PDFDocument({ margin: M, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const companyName = process.env.COMPANY_NAME || 'Wiz3D Prints';
    const SAFE_BOTTOM = 841.89 - M - 18;

    // ── Header ────────────────────────────────────────────────────────────
    let y = 28;

    // Logo (if available)
    try {
      doc.image(LOGO_PATH, M, y, { width: 40, height: 40 });
    } catch {
      // no logo — skip
    }

    // Company name
    doc.font('Helvetica-Bold').fontSize(14).fillColor(DARK)
      .text(companyName, M + 48, y + 4);

    // Title + date range (right side)
    const rangeText = `${fmtDate(report.startDate + 'T00:00:00')} – ${fmtDate(report.endDate + 'T00:00:00')}`;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(ORANGE)
      .text('SALES REPORT', M, y, { align: 'right', width: CW });
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text(rangeText, M, y + 22, { align: 'right', width: CW });

    y = 82;

    // ── Summary Box ───────────────────────────────────────────────────────
    const summaryItems = [
      { label: 'Invoices Included', value: String(report.invoiceCount), mono: false },
      { label: 'Gross Sales (ex. tax & shipping)', value: fmt(report.totalSubtotal), mono: true },
      { label: 'Total Shipping Collected', value: fmt(report.totalShipping), mono: true },
      { label: 'Total Sales Tax Collected', value: fmt(report.totalTax), mono: true },
      { label: 'Grand Total Revenue', value: fmt(report.grandTotal), mono: true, bold: true },
    ];

    const boxH = 12 + summaryItems.length * 16 + 4;
    doc.rect(M, y, CW, boxH).fill(BOX_BG);
    doc.rect(M, y, 4, boxH).fill(ORANGE);

    let sy = y + 8;
    for (const item of summaryItems) {
      doc.font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(DARK)
        .text(item.label, M + 12, sy, { continued: true, width: CW - 12 });
      doc.font(item.bold ? 'Helvetica-Bold' : (item.mono ? 'Courier' : 'Helvetica'))
        .text(item.value, M, sy, { align: 'right', width: CW - 4 });
      sy += 16;
    }

    y = y + boxH + 16;

    // ── Table ──────────────────────────────────────────────────────────────
    // Column definitions (widths must sum to CW = 559)
    const cols = [
      { label: 'Invoice #', w: 65, align: 'left' as const },
      { label: 'Date',      w: 73, align: 'left' as const },
      { label: 'Customer',  w: 130, align: 'left' as const },
      { label: 'Status',    w: 52, align: 'center' as const },
      { label: 'Subtotal',  w: 60, align: 'right' as const },
      { label: 'Shipping',  w: 55, align: 'right' as const },
      { label: 'Tax',       w: 50, align: 'right' as const },
      { label: 'Total',     w: 74, align: 'right' as const },
    ];

    const ROW_H = 16;
    const HDR_H = 18;
    const TXT_PAD = 4;

    function drawHeader(ty: number) {
      doc.rect(M, ty, CW, HDR_H).fill(DARK);
      let cx = M;
      for (const col of cols) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#e5e5e5')
          .text(col.label, cx + TXT_PAD, ty + 5, { width: col.w - TXT_PAD * 2, align: col.align, lineBreak: false });
        cx += col.w;
      }
    }

    function drawRow(row: SalesReportRow, rowIdx: number, ty: number) {
      const bg = rowIdx % 2 === 0 ? '#ffffff' : LIGHT_GRAY;
      doc.rect(M, ty, CW, ROW_H).fill(bg);

      const cells = [
        { val: row.invoiceNumber, align: 'left' as const },
        { val: fmtDate(row.issuedDate), align: 'left' as const },
        { val: row.customerName, align: 'left' as const },
        { val: row.status.charAt(0).toUpperCase() + row.status.slice(1), align: 'center' as const, color: statusColor(row.status) },
        { val: fmt(row.subtotal), align: 'right' as const },
        { val: row.shippingCost > 0 ? fmt(row.shippingCost) : '—', align: 'right' as const },
        { val: row.taxAmount > 0 ? fmt(row.taxAmount) : '—', align: 'right' as const },
        { val: fmt(row.total), align: 'right' as const, bold: true },
      ];

      let cx = M;
      for (let i = 0; i < cols.length; i++) {
        const cell = cells[i];
        const col = cols[i];
        doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
          .fillColor((cell as any).color || DARK)
          .text(cell.val, cx + TXT_PAD, ty + 4, { width: col.w - TXT_PAD * 2, align: cell.align, lineBreak: false });
        cx += col.w;
      }
    }

    function drawTotalsRow(ty: number) {
      doc.rect(M, ty, CW, ROW_H + 2).fill('#cccccc');
      const cells = [
        { val: `${report.invoiceCount} invoice${report.invoiceCount !== 1 ? 's' : ''}`, align: 'left' as const },
        { val: '', align: 'left' as const },
        { val: 'TOTALS', align: 'left' as const },
        { val: '', align: 'center' as const },
        { val: fmt(report.totalSubtotal), align: 'right' as const },
        { val: report.totalShipping > 0 ? fmt(report.totalShipping) : '—', align: 'right' as const },
        { val: report.totalTax > 0 ? fmt(report.totalTax) : '—', align: 'right' as const },
        { val: fmt(report.grandTotal), align: 'right' as const },
      ];

      let cx = M;
      for (let i = 0; i < cols.length; i++) {
        const cell = cells[i];
        const col = cols[i];
        doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
          .text(cell.val, cx + TXT_PAD, ty + 5, { width: col.w - TXT_PAD * 2, align: cell.align, lineBreak: false });
        cx += col.w;
      }
    }

    // Draw first header
    drawHeader(y);
    y += HDR_H;

    let rowIdx = 0;
    for (const row of report.rows) {
      // Page break check
      if (y + ROW_H + ROW_H + 2 > SAFE_BOTTOM) {
        doc.addPage();
        y = 28;
        drawHeader(y);
        y += HDR_H;
      }
      drawRow(row, rowIdx, y);
      y += ROW_H;
      rowIdx++;
    }

    // Totals row
    if (y + ROW_H + 2 > SAFE_BOTTOM) {
      doc.addPage();
      y = 28;
    }
    drawTotalsRow(y);
    y += ROW_H + 2;

    // ── Empty state ────────────────────────────────────────────────────────
    if (report.invoiceCount === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#888888')
        .text('No sent, paid, or shipped invoices found in this date range.', M, y + 10, { align: 'center', width: CW });
      y += 30;
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    const footerY = 841.89 - M - 10;
    doc.font('Helvetica').fontSize(7).fillColor('#999999')
      .text(`Generated on ${new Date().toLocaleString('en-US')}   ·   ${companyName}`, M, footerY, { align: 'center', width: CW });

    doc.end();
  });
}

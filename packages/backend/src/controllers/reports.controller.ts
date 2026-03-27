import { Request, Response, NextFunction } from 'express';
import { getSalesReport } from '../services/sales-report.service.js';
import { generateSalesReportPdf } from '../services/sales-report-pdf.service.js';

export async function getSalesReportData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json({ success: false, error: 'startDate and endDate query params are required (YYYY-MM-DD)' });
      return;
    }
    const report = await getSalesReport(startDate, endDate);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}

export async function downloadSalesReportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json({ success: false, error: 'startDate and endDate query params are required (YYYY-MM-DD)' });
      return;
    }
    const report = await getSalesReport(startDate, endDate);
    const pdfBuffer = await generateSalesReportPdf(report);
    const filename = `sales-report-${startDate}-to-${endDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

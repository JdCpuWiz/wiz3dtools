import { Request, Response, NextFunction } from 'express';
import { SalesInvoiceService } from '../services/sales-invoice.service.js';
import { generateInvoicePdf } from '../services/pdf-generator.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import type { ApiResponse } from '@wizqueue/shared';

const service = new SalesInvoiceService();

export class SalesInvoiceController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoices = await service.getAll();
      res.json({ success: true, data: invoices });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const invoice = await service.getById(id);
      res.json({ success: true, data: invoice });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoice = await service.create(req.body);
      res.status(201).json({ success: true, data: invoice, message: 'Invoice created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const invoice = await service.update(id, req.body);
      res.json({ success: true, data: invoice, message: 'Invoice updated' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.delete(id);
      res.json({ success: true, message: 'Invoice deleted' });
    } catch (error) { next(error); }
  }

  async addLineItem(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const item = await service.addLineItem(invoiceId, req.body);
      res.status(201).json({ success: true, data: item, message: 'Line item added' });
    } catch (error) { next(error); }
  }

  async updateLineItem(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(invoiceId) || isNaN(itemId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const item = await service.updateLineItem(invoiceId, itemId, req.body);
      res.json({ success: true, data: item, message: 'Line item updated' });
    } catch (error) { next(error); }
  }

  async deleteLineItem(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(invoiceId) || isNaN(itemId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.deleteLineItem(invoiceId, itemId);
      res.json({ success: true, message: 'Line item deleted' });
    } catch (error) { next(error); }
  }

  async sendEmail(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

      const invoice = await service.getById(id);
      if (!invoice.customer) {
        res.status(400).json({ success: false, error: 'Invoice has no customer' });
        return;
      }

      const pdfBuffer = await generateInvoicePdf(invoice);
      await sendInvoiceEmail(invoice.customer, invoice.invoiceNumber, pdfBuffer);

      // Mark as sent
      await service.update(id, { status: 'sent' });

      res.json({ success: true, message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}` });
    } catch (error) { next(error); }
  }

  async sendToQueue(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

      const { lineItemIds } = req.body as { lineItemIds?: number[] };
      await service.sendToQueue(id, lineItemIds);

      res.json({ success: true, message: 'Line items sent to print queue' });
    } catch (error) { next(error); }
  }

  async downloadPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

      const invoice = await service.getById(id);
      const pdfBuffer = await generateInvoicePdf(invoice);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) { next(error); }
  }
}

import { Request, Response, NextFunction } from 'express';
import { SalesInvoiceService } from '../services/sales-invoice.service.js';
import { generateInvoicePdf } from '../services/pdf-generator.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import { writeAuditLog } from '../models/audit-log.model.js';
import {
  parseBody,
  createInvoiceSchema,
  updateInvoiceSchema,
  addLineItemSchema,
  updateLineItemSchema,
  sendToQueueSchema,
} from '../validation/schemas.js';
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
      const parsed = parseBody(createInvoiceSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const invoice = await service.create(parsed.data);
      await writeAuditLog(req.user!.username, 'invoice.create', `invoice:${invoice.invoiceNumber}`);
      res.status(201).json({ success: true, data: invoice, message: 'Invoice created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateInvoiceSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const invoice = await service.update(id, parsed.data);
      res.json({ success: true, data: invoice, message: 'Invoice updated' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.delete(id);
      await writeAuditLog(req.user!.username, 'invoice.delete', `invoice:${id}`);
      res.json({ success: true, message: 'Invoice deleted' });
    } catch (error) { next(error); }
  }

  async addLineItem(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(addLineItemSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const item = await service.addLineItem(invoiceId, parsed.data);
      res.status(201).json({ success: true, data: item, message: 'Line item added' });
    } catch (error) { next(error); }
  }

  async updateLineItem(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(invoiceId) || isNaN(itemId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateLineItemSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const item = await service.updateLineItem(invoiceId, itemId, parsed.data);
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

      await writeAuditLog(req.user!.username, 'invoice.send_email', `invoice:${invoice.invoiceNumber}`, `to=${invoice.customer.email}`);
      res.json({ success: true, message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}` });
    } catch (error) { next(error); }
  }

  async ship(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.ship(id);
      await writeAuditLog(req.user!.username, 'invoice.ship', `invoice:${id}`);
      res.json({ success: true, message: 'Invoice marked as shipped and customer notified' });
    } catch (error) { next(error); }
  }

  async sendToQueue(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(sendToQueueSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      await service.sendToQueue(id, parsed.data.lineItemIds);
      await writeAuditLog(req.user!.username, 'invoice.send_to_queue', `invoice:${id}`);
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

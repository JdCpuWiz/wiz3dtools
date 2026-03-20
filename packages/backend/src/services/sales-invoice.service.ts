import { SalesInvoiceModel } from '../models/sales-invoice.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import { QueueItemModel } from '../models/queue-item.model.js';
import { ProductModel } from '../models/product.model.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { LineItemColorModel, QueueItemColorModel } from '../models/item-color.model.js';
import { sendShippingEmail } from './email.service.js';
import { pool } from '../config/database.js';
import type {
  SalesInvoice,
  CreateSalesInvoiceDto,
  UpdateSalesInvoiceDto,
  CreateLineItemDto,
  InvoiceLineItem,
} from '@wizqueue/shared';

export class SalesInvoiceService {
  async getAll(): Promise<SalesInvoice[]> {
    return SalesInvoiceModel.findAll();
  }

  async getById(id: number): Promise<SalesInvoice> {
    const invoice = await SalesInvoiceModel.findById(id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async create(data: CreateSalesInvoiceDto): Promise<SalesInvoice> {
    return SalesInvoiceModel.create(data);
  }

  async update(id: number, data: UpdateSalesInvoiceDto): Promise<SalesInvoice> {
    const invoice = await SalesInvoiceModel.update(id, data);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async delete(id: number): Promise<void> {
    const invoice = await this.getById(id);
    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be deleted');
    }
    const deleted = await SalesInvoiceModel.delete(id);
    if (!deleted) throw new Error('Invoice not found');
  }

  async addLineItem(invoiceId: number, data: CreateLineItemDto): Promise<InvoiceLineItem> {
    await this.getById(invoiceId); // ensure exists
    const lineItem = await InvoiceLineItemModel.create(invoiceId, data);

    // Auto-populate colors+weights from product if a product is linked
    if (data.productId) {
      try {
        const productColors = await ProductColorModel.findByProduct(data.productId);
        if (productColors.length > 0) {
          await LineItemColorModel.setColors(
            lineItem.id,
            productColors.map((pc, i) => ({
              colorId: pc.colorId,
              isPrimary: i === 0,
              note: null,
              sortOrder: pc.sortOrder,
              weightGrams: pc.weightGrams,
            })),
          );
          const colors = await LineItemColorModel.findByLineItem(lineItem.id);
          return { ...lineItem, colors };
        }
      } catch (err) {
        console.error('Auto-populate product colors error (non-fatal):', err);
      }
    }

    return lineItem;
  }

  async updateLineItem(invoiceId: number, itemId: number, data: Partial<CreateLineItemDto>): Promise<InvoiceLineItem> {
    const item = await InvoiceLineItemModel.findById(itemId);
    if (!item || item.invoiceId !== invoiceId) throw new Error('Line item not found');
    const updated = await InvoiceLineItemModel.update(itemId, data);
    if (!updated) throw new Error('Line item not found');
    return updated;
  }

  async deleteLineItem(invoiceId: number, itemId: number): Promise<void> {
    const item = await InvoiceLineItemModel.findById(itemId);
    if (!item || item.invoiceId !== invoiceId) throw new Error('Line item not found');
    await InvoiceLineItemModel.delete(itemId);
  }

  async ship(invoiceId: number): Promise<void> {
    const invoice = await this.getById(invoiceId);
    if (invoice.shippedAt) throw new Error('Invoice has already been shipped');
    const isPickup = invoice.carrier === 'Customer Pickup';
    if (!isPickup && !invoice.trackingNumber?.trim()) throw new Error('A tracking number is required before marking as shipped');
    if (!invoice.customer) throw new Error('Invoice has no customer');
    if (!isPickup && !invoice.customer.email) throw new Error(`Customer "${invoice.customer.contactName}" has no email address`);

    await SalesInvoiceModel.markShipped(invoiceId, invoice.trackingNumber?.trim() || null);
    await sendShippingEmail(invoice.customer, invoice.invoiceNumber, invoice.carrier, invoice.trackingNumber?.trim() || null);

    // Remove all queue items linked to this invoice's line items (any status)
    await pool.query(
      `DELETE FROM queue_items
       WHERE id IN (
         SELECT queue_item_id
         FROM invoice_line_items
         WHERE invoice_id = $1
           AND queue_item_id IS NOT NULL
       )`,
      [invoiceId]
    );

    // Recalculate units_sold for all products on this invoice based on all shipped invoices
    const productIds = invoice.lineItems
      .map((li) => li.productId)
      .filter((id): id is number => id !== null);
    await ProductModel.recalcSoldFromShippedInvoices(productIds);
  }

  async sendToQueue(invoiceId: number, lineItemIds?: number[]): Promise<void> {
    const invoice = await this.getById(invoiceId);
    const items = lineItemIds
      ? invoice.lineItems.filter((li) => lineItemIds.includes(li.id))
      : invoice.lineItems;

    for (const lineItem of items as InvoiceLineItem[]) {
      if (lineItem.queueItemId) continue; // already queued

      const queueItem = await QueueItemModel.create({
        productName: lineItem.productName,
        sku: lineItem.sku || undefined,
        details: lineItem.details || undefined,
        quantity: lineItem.quantity,
        status: 'pending',
      });

      await InvoiceLineItemModel.markSentToQueue(lineItem.id, queueItem.id);

      // Copy colors from line item to queue item
      if (lineItem.colors && lineItem.colors.length > 0) {
        await QueueItemColorModel.copyFromLineItem(lineItem.id, queueItem.id);
      }

      // units_sold is recalculated at ship time — not tracked here
    }
  }
}

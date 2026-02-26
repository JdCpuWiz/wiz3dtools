import { SalesInvoiceModel } from '../models/sales-invoice.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import { QueueItemModel } from '../models/queue-item.model.js';
import { ProductModel } from '../models/product.model.js';
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
    return InvoiceLineItemModel.create(invoiceId, data);
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

  async sendToQueue(invoiceId: number, lineItemIds?: number[]): Promise<void> {
    const invoice = await this.getById(invoiceId);
    const items = lineItemIds
      ? invoice.lineItems.filter((li) => lineItemIds.includes(li.id))
      : invoice.lineItems;

    for (const lineItem of items as InvoiceLineItem[]) {
      if (lineItem.queueItemId) continue; // already queued

      const queueItem = await QueueItemModel.create({
        productName: lineItem.productName,
        details: lineItem.details || undefined,
        quantity: lineItem.quantity,
        status: 'pending',
      });

      await InvoiceLineItemModel.markSentToQueue(lineItem.id, queueItem.id);

      // Track units sold on the product
      if (lineItem.productId) {
        await ProductModel.incrementSold(lineItem.productId, lineItem.quantity);
      }
    }
  }
}

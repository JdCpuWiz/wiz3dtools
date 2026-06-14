import { SalesInvoiceModel } from '../models/sales-invoice.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import { ProductModel } from '../models/product.model.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { LineItemColorModel } from '../models/item-color.model.js';
import type {
  SalesInvoice,
  CreateSalesInvoiceDto,
  UpdateSalesInvoiceDto,
  CreateLineItemDto,
  InvoiceLineItem,
  LineItemStatus,
} from '@wizqueue/shared';
// InvoiceLineItem stays imported — addLineItem returns it.

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

  async updateLineItemStatus(invoiceId: number, itemId: number, status: LineItemStatus): Promise<InvoiceLineItem> {
    const item = await InvoiceLineItemModel.findById(itemId);
    if (!item || item.invoiceId !== invoiceId) throw new Error('Line item not found');
    const updated = await InvoiceLineItemModel.updateStatus(itemId, status);
    if (!updated) throw new Error('Line item not found');
    return updated;
  }

  async ship(invoiceId: number): Promise<void> {
    const invoice = await this.getById(invoiceId);
    if (invoice.shippedAt) throw new Error('Invoice has already been shipped');
    const isPickup = invoice.carrier === 'Customer Pickup';
    if (!isPickup && !invoice.trackingNumber?.trim()) throw new Error('A tracking number is required before marking as shipped');
    if (!invoice.customer) throw new Error('Invoice has no customer');
    if (!isPickup && !invoice.customer.email) throw new Error(`Customer "${invoice.customer.contactName}" has no email address`);
    if (invoice.lineItems.length === 0) throw new Error('Invoice has no line items');
    const pending = invoice.lineItems.filter((li) => li.status === 'pending');
    if (pending.length > 0) {
      throw new Error(`${pending.length} line item${pending.length === 1 ? '' : 's'} still pending — mark each as completed or backordered before shipping`);
    }

    await SalesInvoiceModel.markShipped(invoiceId, invoice.trackingNumber?.trim() || null);

    // BuildPlan #12 Phase 9 — single source of truth for the shipped
    // notification: wiz3d-prints sends the email for both consumer AND
    // wholesale customers (its receiver no longer gates on whether a
    // consumer User exists). The previous wiz3dtools-side sendShippingEmail
    // is gone; this webhook is fire-and-forget and a missing URL silently
    // skips so the Ship action itself never fails on a notify error.
    const webhookBase = process.env.WIZ3D_PRINTS_URL;
    const adminToken = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;
    if (webhookBase && adminToken && invoice.customer) {
      void fetch(`${webhookBase}/api/admin/orders/shipped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({
          orderId: invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customer.id,
          customerEmail: invoice.customer.email,
          customerName: invoice.customer.contactName,
          carrier: invoice.carrier,
          trackingNumber: invoice.trackingNumber?.trim() || null,
        }),
      }).catch((err) => {
        console.warn('[sales-invoice/ship] wiz3d-prints webhook failed:', err?.message ?? err);
      });
    }

    // BuildPlan #6 Phase 3 (2026-06-04): queue_items table dropped. The
    // previous queue-cleanup query (DELETE FROM queue_items WHERE id IN
    // SELECT queue_item_id ...) is gone with it. Printing happens in
    // BamBuddy now; the invoice ship event records the sale and updates
    // units_sold, nothing else.

    // Recalculate units_sold for all products on this invoice based on all shipped invoices
    const productIds = invoice.lineItems
      .map((li) => li.productId)
      .filter((id): id is number => id !== null);
    await ProductModel.recalcSoldFromShippedInvoices(productIds);
  }
}

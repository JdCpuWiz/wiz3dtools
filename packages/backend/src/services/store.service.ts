import { pool } from '../config/database.js';
import { SalesInvoiceModel } from '../models/sales-invoice.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import type { SalesInvoice } from '@wizqueue/shared';

export interface StoreProduct {
  id: number;
  name: string;
  storeTitle: string | null;
  storeDescription: string | null;
  sku: string | null;
  wholesalePrice: number;
  retailPrice: number;
  categoryId: number | null;
  category: { id: number; name: string; slug: string } | null;
  images: { id: number; url: string; sortOrder: number; isPrimary: boolean }[];
}

export interface StoreOrderLineItem {
  productId: number;
  quantity: number;
  unitPrice: number; // wholesalePrice at time of order
  productName?: string;
  notes?: string;
}

export interface CreateStoreOrderDto {
  customerId: number;
  notes?: string;
  lineItems: StoreOrderLineItem[];
}

export interface StoreOrderSummary {
  id: number;
  invoiceNumber: string;
  status: string;
  taxExempt: boolean;
  subtotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
}

export class StoreService {
  async getProducts(): Promise<StoreProduct[]> {
    const result = await pool.query(`
      SELECT
        p.id, p.name, p.sku,
        p.store_title      AS "storeTitle",
        p.store_description AS "storeDescription",
        p.wholesale_price  AS "wholesalePrice",
        p.retail_price     AS "retailPrice",
        p.category_id      AS "categoryId",
        c.id               AS "cat_id",
        c.name             AS "cat_name",
        c.slug             AS "cat_slug"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.published_to_store = TRUE AND p.active = TRUE
      ORDER BY COALESCE(c.sort_order, 999) ASC, p.name ASC
    `);

    if (result.rows.length === 0) return [];

    const productIds = result.rows.map((r) => r.id as number);

    // Batch-load images
    const imgResult = await pool.query(
      `SELECT id, product_id AS "productId", url, sort_order AS "sortOrder", is_primary AS "isPrimary"
       FROM product_images WHERE product_id = ANY($1)
       ORDER BY sort_order ASC, id ASC`,
      [productIds],
    );
    const imageMap = new Map<number, StoreProduct['images']>();
    for (const img of imgResult.rows) {
      const list = imageMap.get(img.productId as number) ?? [];
      list.push({ id: img.id as number, url: img.url as string, sortOrder: img.sortOrder as number, isPrimary: img.isPrimary as boolean });
      imageMap.set(img.productId as number, list);
    }

    return result.rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      storeTitle: r.storeTitle as string | null,
      storeDescription: r.storeDescription as string | null,
      sku: r.sku as string | null,
      wholesalePrice: parseFloat(r.wholesalePrice as string),
      retailPrice: parseFloat(r.retailPrice as string),
      categoryId: r.categoryId as number | null,
      category: r.cat_id
        ? { id: r.cat_id as number, name: r.cat_name as string, slug: r.cat_slug as string }
        : null,
      images: imageMap.get(r.id as number) ?? [],
    }));
  }

  async createOrder(data: CreateStoreOrderDto): Promise<SalesInvoice> {
    // Validate all products are published and active
    for (const item of data.lineItems) {
      const result = await pool.query(
        `SELECT id, name FROM products WHERE id = $1 AND published_to_store = TRUE AND active = TRUE`,
        [item.productId],
      );
      if (!result.rows[0]) {
        throw Object.assign(new Error(`Product ${item.productId} is not available in the store`), { statusCode: 400 });
      }
    }

    // Create draft invoice — always tax-exempt for wholesalers
    const invoice = await SalesInvoiceModel.create({
      customerId: data.customerId,
      taxExempt: true,
      taxRate: 0,
      notes: data.notes ?? undefined,
    });

    // Add line items
    for (const item of data.lineItems) {
      const productResult = await pool.query(
        `SELECT name, sku FROM products WHERE id = $1`,
        [item.productId],
      );
      const product = productResult.rows[0];
      await InvoiceLineItemModel.create(invoice.id, {
        productId: item.productId,
        productName: item.productName || (product?.name as string),
        sku: (product?.sku as string | null) ?? undefined,
        details: item.notes || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }

    // Return the full invoice with line items
    const full = await SalesInvoiceModel.findById(invoice.id);
    if (!full) throw new Error('Failed to retrieve created order');
    return full;
  }

  async getOrdersByCustomer(customerId: number): Promise<StoreOrderSummary[]> {
    const result = await pool.query(
      `SELECT
         si.id, si.invoice_number AS "invoiceNumber", si.status,
         si.tax_exempt AS "taxExempt", si.shipping_cost AS "shippingCost",
         si.notes, si.created_at AS "createdAt",
         COALESCE(SUM(ili.quantity * ili.unit_price), 0) AS subtotal
       FROM sales_invoices si
       LEFT JOIN invoice_line_items ili ON ili.invoice_id = si.id
       WHERE si.customer_id = $1
       GROUP BY si.id
       ORDER BY si.created_at DESC`,
      [customerId],
    );

    return result.rows.map((r) => {
      const subtotal = parseFloat(r.subtotal as string);
      const shipping = parseFloat(r.shippingCost as string || '0');
      return {
        id: r.id as number,
        invoiceNumber: r.invoiceNumber as string,
        status: r.status as string,
        taxExempt: r.taxExempt as boolean,
        subtotal,
        total: subtotal + shipping,
        notes: r.notes as string | null,
        createdAt: r.createdAt as string,
      };
    });
  }
}

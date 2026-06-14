import { pool } from '../config/database.js';
import { SalesInvoiceModel } from '../models/sales-invoice.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { LineItemColorModel } from '../models/item-color.model.js';
import { ColorModel } from '../models/color.model.js';
import type { SalesInvoice, Color, ProductColor, ItemColorDto } from '@wizqueue/shared';

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
  /** Product recipe — default colors with per-slot weights. Pickers use these as defaults. */
  colors: ProductColor[];
}

export interface StoreOrderLineItem {
  productId: number;
  quantity: number;
  unitPrice: number; // wholesalePrice at time of order
  productName?: string;
  notes?: string;
  /**
   * Per-slot color override. Must have same length as product recipe.
   * Weights come from the recipe (server-side source of truth) — client
   * weightGrams is ignored if provided. Omit to use recipe defaults.
   */
  colors?: ItemColorDto[];
}

export interface CreateStoreOrderDto {
  customerId: number;
  notes?: string;
  lineItems: StoreOrderLineItem[];
  /** Defaults to true (wholesale behavior). Consumer checkout passes false. */
  taxExempt?: boolean;
  /** Defaults to 0. Consumer checkout passes the applicable nexus rate. */
  taxRate?: number;
}

export interface StoreOrderSummary {
  id: number;
  invoiceNumber: string;
  status: string;
  taxExempt: boolean;
  subtotal: number;
  total: number;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
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

    // Batch-load product color recipes (defaults the picker hydrates from)
    const colorMap = await ProductColorModel.findByProductIds(productIds);

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
      colors: colorMap.get(r.id as number) ?? [],
    }));
  }

  async getActiveColors(): Promise<Color[]> {
    return ColorModel.findAll(true);
  }

  async createOrder(data: CreateStoreOrderDto): Promise<SalesInvoice> {
    // Pre-validate each line item: product is available AND has a color recipe.
    // We also resolve the final colors[] per item up-front so we either succeed
    // atomically or fail before mutating any state.
    const resolved: { item: StoreOrderLineItem; productName: string; productSku: string | null; colors: ItemColorDto[] }[] = [];

    for (const item of data.lineItems) {
      const productResult = await pool.query(
        `SELECT id, name, sku FROM products WHERE id = $1 AND published_to_store = TRUE AND active = TRUE`,
        [item.productId],
      );
      const product = productResult.rows[0];
      if (!product) {
        throw Object.assign(new Error(`Product ${item.productId} is not available in the store`), { statusCode: 400 });
      }

      const recipe = await ProductColorModel.findByProduct(item.productId);
      if (recipe.length === 0) {
        throw Object.assign(
          new Error(`Product ${item.productId} (${product.name}) has no color recipe configured and cannot be ordered`),
          { statusCode: 400 },
        );
      }

      let colors: ItemColorDto[];
      if (item.colors === undefined) {
        // No override — use recipe defaults
        colors = recipe.map((pc, i) => ({
          colorId: pc.colorId,
          isPrimary: i === 0,
          sortOrder: pc.sortOrder ?? i,
          weightGrams: pc.weightGrams,
          note: null,
        }));
      } else {
        if (item.colors.length !== recipe.length) {
          throw Object.assign(
            new Error(`Color override for product ${item.productId} must have ${recipe.length} slot(s), got ${item.colors.length}`),
            { statusCode: 400 },
          );
        }
        // Validate every colorId is active
        const colorIds = item.colors.map((c) => c.colorId);
        const activeResult = await pool.query(
          `SELECT id FROM colors WHERE id = ANY($1) AND active = TRUE`,
          [colorIds],
        );
        const activeSet = new Set(activeResult.rows.map((r) => r.id as number));
        for (const c of item.colors) {
          if (!activeSet.has(c.colorId)) {
            throw Object.assign(new Error(`Color ${c.colorId} is not active or does not exist`), { statusCode: 400 });
          }
        }
        // Apply recipe weights positionally — server is the source of truth
        colors = item.colors.map((c, i) => ({
          colorId: c.colorId,
          isPrimary: c.isPrimary ?? (i === 0),
          sortOrder: c.sortOrder ?? i,
          weightGrams: recipe[i].weightGrams,
          note: c.note ?? null,
        }));
      }

      resolved.push({
        item,
        productName: product.name as string,
        productSku: (product.sku as string | null) ?? null,
        colors,
      });
    }

    // Create draft invoice. Defaults preserve wholesale (taxExempt:true, taxRate:0);
    // consumer checkout flips both to charge sales tax.
    const invoice = await SalesInvoiceModel.create({
      customerId: data.customerId,
      taxExempt: data.taxExempt ?? true,
      taxRate: data.taxRate ?? 0,
      notes: data.notes ?? undefined,
    });

    // Add line items + persist colors
    for (const r of resolved) {
      const lineItem = await InvoiceLineItemModel.create(invoice.id, {
        productId: r.item.productId,
        productName: r.item.productName || r.productName,
        sku: r.productSku ?? undefined,
        details: r.item.notes || undefined,
        quantity: r.item.quantity,
        unitPrice: r.item.unitPrice,
      });
      await LineItemColorModel.setColors(lineItem.id, r.colors);
    }

    // Return the full invoice with line items
    const full = await SalesInvoiceModel.findById(invoice.id);
    if (!full) throw new Error('Failed to retrieve created order');
    return full;
  }

  async getOrderById(id: number, customerId: number): Promise<SalesInvoice | null> {
    const invoice = await SalesInvoiceModel.findById(id);
    // Ensure the invoice belongs to this customer
    if (!invoice || invoice.customerId !== customerId) return null;
    return invoice;
  }

  /**
   * Idempotent paid flip. Verifies the invoice belongs to the passed customerId
   * before touching it. Returns `transitioned:true` only on the first call so
   * the caller (Stripe / PayPal webhook) can decide whether to fire a
   * confirmation email — retries get `transitioned:false` and skip the send.
   */
  async markOrderPaid(
    id: number,
    customerId: number,
    paymentProvider: string,
    paymentRef: string,
  ): Promise<{ transitioned: boolean; invoice: SalesInvoice } | null> {
    const existing = await SalesInvoiceModel.findById(id);
    if (!existing || existing.customerId !== customerId) return null;
    return SalesInvoiceModel.markPaid(id, paymentProvider, paymentRef);
  }

  async getOrdersByCustomer(customerId: number): Promise<StoreOrderSummary[]> {
    const result = await pool.query(
      `SELECT
         si.id, si.invoice_number AS "invoiceNumber", si.status,
         si.tax_exempt AS "taxExempt", si.shipping_cost AS "shippingCost",
         si.carrier, si.tracking_number AS "trackingNumber",
         si.shipped_at AS "shippedAt",
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
        carrier: (r.carrier as string | null) ?? null,
        trackingNumber: (r.trackingNumber as string | null) ?? null,
        shippedAt: r.shippedAt
          ? (r.shippedAt instanceof Date
              ? r.shippedAt.toISOString()
              : (r.shippedAt as string))
          : null,
        notes: r.notes as string | null,
        createdAt: r.createdAt as string,
      };
    });
  }
}

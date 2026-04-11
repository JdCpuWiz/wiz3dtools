import { pool } from '../config/database.js';
import type { InvoiceLineItem, CreateLineItemDto } from '@wizqueue/shared';
import { LineItemColorModel } from './item-color.model.js';

const SELECT_FIELDS = `
  id, invoice_id as "invoiceId", product_id as "productId",
  product_name as "productName", sku, details, quantity,
  unit_price as "unitPrice", queue_item_id as "queueItemId",
  created_at as "createdAt"
`;

async function attachColors(rows: Record<string, unknown>[]): Promise<InvoiceLineItem[]> {
  return Promise.all(
    rows.map(async (r) => {
      const colors = await LineItemColorModel.findByLineItem(r.id as number);
      return { ...r, unitPrice: parseFloat(r.unitPrice as string), colors } as InvoiceLineItem;
    }),
  );
}

export class InvoiceLineItemModel {
  static async findByInvoice(invoiceId: number): Promise<InvoiceLineItem[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id ASC`,
      [invoiceId],
    );
    return attachColors(result.rows);
  }

  static async findByInvoices(invoiceIds: number[]): Promise<InvoiceLineItem[]> {
    if (invoiceIds.length === 0) return [];
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM invoice_line_items WHERE invoice_id = ANY($1) ORDER BY invoice_id ASC, id ASC`,
      [invoiceIds],
    );
    if (result.rows.length === 0) return [];
    const lineItemIds = result.rows.map((r) => r.id as number);
    const colorMap = await LineItemColorModel.findByLineItemIds(lineItemIds);
    return result.rows.map((row) => ({
      ...row,
      unitPrice: parseFloat(row.unitPrice as string),
      colors: colorMap.get(row.id as number) ?? [],
    })) as InvoiceLineItem[];
  }

  static async findById(id: number): Promise<InvoiceLineItem | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM invoice_line_items WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    const colors = await LineItemColorModel.findByLineItem(id);
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice), colors };
  }

  static async create(invoiceId: number, data: CreateLineItemDto): Promise<InvoiceLineItem> {
    const result = await pool.query(
      `INSERT INTO invoice_line_items (invoice_id, product_id, product_name, sku, details, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SELECT_FIELDS}`,
      [invoiceId, data.productId || null, data.productName, data.sku || null, data.details || null, data.quantity, data.unitPrice],
    );
    const row = result.rows[0];
    return { ...row, unitPrice: parseFloat(row.unitPrice), colors: [] };
  }

  static async update(id: number, data: Partial<CreateLineItemDto>): Promise<InvoiceLineItem | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.productName !== undefined) { fields.push(`product_name = $${i++}`); values.push(data.productName); }
    if (data.sku !== undefined) { fields.push(`sku = $${i++}`); values.push(data.sku ?? null); }
    if (data.details !== undefined) { fields.push(`details = $${i++}`); values.push(data.details ?? null); }
    if (data.quantity !== undefined) { fields.push(`quantity = $${i++}`); values.push(data.quantity); }
    if (data.unitPrice !== undefined) { fields.push(`unit_price = $${i++}`); values.push(data.unitPrice); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE invoice_line_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    if (!result.rows[0]) return null;
    const colors = await LineItemColorModel.findByLineItem(id);
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice), colors };
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM invoice_line_items WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  static async markSentToQueue(lineItemId: number, queueItemId: number): Promise<void> {
    await pool.query(
      'UPDATE invoice_line_items SET queue_item_id = $1 WHERE id = $2',
      [queueItemId, lineItemId],
    );
  }
}

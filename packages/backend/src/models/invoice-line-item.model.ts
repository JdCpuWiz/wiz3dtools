import { pool } from '../config/database.js';
import type { InvoiceLineItem, CreateLineItemDto } from '@wizqueue/shared';

const SELECT_FIELDS = `
  id, invoice_id as "invoiceId", product_name as "productName",
  details, quantity, unit_price as "unitPrice",
  queue_item_id as "queueItemId", created_at as "createdAt"
`;

export class InvoiceLineItemModel {
  static async findByInvoice(invoiceId: number): Promise<InvoiceLineItem[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id ASC`,
      [invoiceId],
    );
    return result.rows;
  }

  static async findById(id: number): Promise<InvoiceLineItem | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM invoice_line_items WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(invoiceId: number, data: CreateLineItemDto): Promise<InvoiceLineItem> {
    const result = await pool.query(
      `INSERT INTO invoice_line_items (invoice_id, product_name, details, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_FIELDS}`,
      [invoiceId, data.productName, data.details || null, data.quantity, data.unitPrice],
    );
    return result.rows[0];
  }

  static async update(id: number, data: Partial<CreateLineItemDto>): Promise<InvoiceLineItem | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.productName !== undefined) { fields.push(`product_name = $${i++}`); values.push(data.productName); }
    if (data.details !== undefined) { fields.push(`details = $${i++}`); values.push(data.details ?? null); }
    if (data.quantity !== undefined) { fields.push(`quantity = $${i++}`); values.push(data.quantity); }
    if (data.unitPrice !== undefined) { fields.push(`unit_price = $${i++}`); values.push(data.unitPrice); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE invoice_line_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    return result.rows[0] || null;
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

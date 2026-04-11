import { pool } from '../config/database.js';
import type {
  QueueItem,
  CreateQueueItemDto,
  UpdateQueueItemDto,
} from '@wizqueue/shared';
import { QueueItemColorModel } from './item-color.model.js';

const SELECT_FIELDS = `
  id, product_name as "productName", sku, details, quantity, position,
  status, invoice_id as "invoiceId", priority, notes, printer_name as "printerName",
  is_inhouse as "isInhouse", created_at as "createdAt", updated_at as "updatedAt"
`;

async function attachColors(rows: QueueItem[]): Promise<QueueItem[]> {
  return Promise.all(
    rows.map(async (r) => {
      const colors = await QueueItemColorModel.findByQueueItem(r.id);
      return { ...r, colors };
    }),
  );
}

export class QueueItemModel {
  static async findAll(): Promise<QueueItem[]> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM queue_items ORDER BY position ASC`);
    return attachColors(result.rows);
  }

  static async findById(id: number): Promise<QueueItem | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM queue_items WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    const colors = await QueueItemColorModel.findByQueueItem(id);
    return { ...result.rows[0], colors };
  }

  static async create(data: CreateQueueItemDto): Promise<QueueItem> {
    // Get the next position if not provided
    const position = data.position !== undefined ? data.position : await this.getNextPosition();

    const query = `
      INSERT INTO queue_items (
        product_name, sku, details, quantity, position, status,
        invoice_id, priority, notes, printer_name, is_inhouse
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id, product_name as "productName", sku, details, quantity, position,
        status, invoice_id as "invoiceId", priority, notes, printer_name as "printerName",
        is_inhouse as "isInhouse", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const values = [
      data.productName,
      data.sku || null,
      data.details || null,
      data.quantity,
      position,
      data.status || 'pending',
      data.invoiceId || null,
      data.priority || 0,
      data.notes || null,
      data.printerName || null,
      data.isInhouse ?? false,
    ];

    const result = await pool.query(query, values);
    return { ...result.rows[0], colors: [] };
  }

  static async createMany(items: CreateQueueItemDto[]): Promise<QueueItem[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdItems: QueueItem[] = [];
      let position = await this.getNextPosition();

      for (const item of items) {
        const query = `
          INSERT INTO queue_items (
            product_name, sku, details, quantity, position, status,
            invoice_id, priority, notes, printer_name, is_inhouse
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            id, product_name as "productName", sku, details, quantity, position,
            status, invoice_id as "invoiceId", priority, notes, printer_name as "printerName",
            is_inhouse as "isInhouse", created_at as "createdAt", updated_at as "updatedAt"
        `;

        const values = [
          item.productName,
          item.sku || null,
          item.details || null,
          item.quantity,
          item.position !== undefined ? item.position : position++,
          item.status || 'pending',
          item.invoiceId || null,
          item.priority || 0,
          item.notes || null,
          item.printerName || null,
          item.isInhouse ?? false,
        ];

        const result = await client.query(query, values);
        createdItems.push({ ...result.rows[0], colors: [] });
      }

      await client.query('COMMIT');
      return createdItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(id: number, data: UpdateQueueItemDto): Promise<QueueItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.productName !== undefined) {
      fields.push(`product_name = $${paramCount++}`);
      values.push(data.productName);
    }
    if (data.sku !== undefined) {
      fields.push(`sku = $${paramCount++}`);
      values.push(data.sku ?? null);
    }
    if (data.details !== undefined) {
      fields.push(`details = $${paramCount++}`);
      values.push(data.details);
    }
    if (data.quantity !== undefined) {
      fields.push(`quantity = $${paramCount++}`);
      values.push(data.quantity);
    }
    if (data.position !== undefined) {
      fields.push(`position = $${paramCount++}`);
      values.push(data.position);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.priority !== undefined) {
      fields.push(`priority = $${paramCount++}`);
      values.push(data.priority);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(data.notes);
    }
    if (data.printerName !== undefined) {
      fields.push(`printer_name = $${paramCount++}`);
      values.push(data.printerName ?? null);
    }
    if (data.isInhouse !== undefined) {
      fields.push(`is_inhouse = $${paramCount++}`);
      values.push(data.isInhouse);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE queue_items
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING
        id, product_name as "productName", sku, details, quantity, position,
        status, invoice_id as "invoiceId", priority, notes, printer_name as "printerName",
        is_inhouse as "isInhouse", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const result = await pool.query(query, values);
    if (!result.rows[0]) return null;
    const colors = await QueueItemColorModel.findByQueueItem(id);
    return { ...result.rows[0], colors };
  }

  /** Find the oldest in-house queue item for a printer with the given status. */
  static async findInhouseForPrinter(printerName: string, status: string): Promise<QueueItem | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM queue_items
       WHERE is_inhouse = true AND printer_name = $1 AND status = $2
       ORDER BY position ASC, created_at ASC
       LIMIT 1`,
      [printerName, status],
    );
    if (!result.rows[0]) return null;
    const colors = await QueueItemColorModel.findByQueueItem(result.rows[0].id);
    return { ...result.rows[0], colors };
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM queue_items WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  static async reorder(itemId: number, newPosition: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current position
      const currentResult = await client.query(
        'SELECT position FROM queue_items WHERE id = $1',
        [itemId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Item not found');
      }

      const currentPosition = currentResult.rows[0].position;

      if (currentPosition === newPosition) {
        await client.query('COMMIT');
        return;
      }

      // Shift other items
      if (newPosition < currentPosition) {
        // Moving up: shift items down
        await client.query(
          'UPDATE queue_items SET position = position + 1 WHERE position >= $1 AND position < $2',
          [newPosition, currentPosition]
        );
      } else {
        // Moving down: shift items up
        await client.query(
          'UPDATE queue_items SET position = position - 1 WHERE position > $1 AND position <= $2',
          [currentPosition, newPosition]
        );
      }

      // Update the moved item
      await client.query(
        'UPDATE queue_items SET position = $1 WHERE id = $2',
        [newPosition, itemId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private static async getNextPosition(): Promise<number> {
    const result = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM queue_items');
    return result.rows[0].next_position;
  }
}

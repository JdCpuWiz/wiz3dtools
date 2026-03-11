import { pool } from '../config/database.js';
import type { ItemColor, ItemColorDto } from '@wizqueue/shared';

const COLOR_JOIN = `
  JOIN colors c ON c.id = ic.color_id
`;

const SELECT_FIELDS = (_table: string) => `
  ic.id,
  ic.color_id as "colorId",
  ic.is_primary as "isPrimary",
  ic.note,
  ic.sort_order as "sortOrder",
  json_build_object(
    'id', c.id,
    'name', c.name,
    'hex', c.hex,
    'active', c.active,
    'sortOrder', c.sort_order,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  ) as color
`;

export class LineItemColorModel {
  static async findByLineItem(lineItemId: number): Promise<ItemColor[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS('line_item_colors')} FROM line_item_colors ic ${COLOR_JOIN}
       WHERE ic.line_item_id = $1 ORDER BY ic.is_primary DESC, ic.sort_order ASC`,
      [lineItemId],
    );
    return result.rows;
  }

  static async setColors(lineItemId: number, colors: ItemColorDto[]): Promise<ItemColor[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM line_item_colors WHERE line_item_id = $1', [lineItemId]);

      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        await client.query(
          `INSERT INTO line_item_colors (line_item_id, color_id, is_primary, note, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [lineItemId, c.colorId, c.isPrimary, c.note ?? null, c.sortOrder ?? i],
        );
      }

      await client.query('COMMIT');
      return this.findByLineItem(lineItemId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export class QueueItemColorModel {
  static async findByQueueItem(queueItemId: number): Promise<ItemColor[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS('queue_item_colors')} FROM queue_item_colors ic ${COLOR_JOIN}
       WHERE ic.queue_item_id = $1 ORDER BY ic.is_primary DESC, ic.sort_order ASC`,
      [queueItemId],
    );
    return result.rows;
  }

  static async setColors(queueItemId: number, colors: ItemColorDto[]): Promise<ItemColor[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM queue_item_colors WHERE queue_item_id = $1', [queueItemId]);

      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        await client.query(
          `INSERT INTO queue_item_colors (queue_item_id, color_id, is_primary, note, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [queueItemId, c.colorId, c.isPrimary, c.note ?? null, c.sortOrder ?? i],
        );
      }

      await client.query('COMMIT');
      return this.findByQueueItem(queueItemId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async copyFromLineItem(lineItemId: number, queueItemId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT color_id, is_primary, note, sort_order FROM line_item_colors WHERE line_item_id = $1`,
        [lineItemId],
      );

      for (const row of existing.rows) {
        await client.query(
          `INSERT INTO queue_item_colors (queue_item_id, color_id, is_primary, note, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [queueItemId, row.color_id, row.is_primary, row.note, row.sort_order],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

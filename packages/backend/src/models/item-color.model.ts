import { pool } from '../config/database.js';
import type { ItemColor, ItemColorDto } from '@wizqueue/shared';

const COLOR_JOIN = `
  JOIN colors c ON c.id = ic.color_id
  LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
`;

const SELECT_FIELDS = (_table: string) => `
  ic.id,
  ic.color_id as "colorId",
  ic.is_primary as "isPrimary",
  ic.note,
  ic.sort_order as "sortOrder",
  ic.weight_grams as "weightGrams",
  json_build_object(
    'id', c.id,
    'name', c.name,
    'hex', c.hex,
    'active', c.active,
    'sortOrder', c.sort_order,
    'manufacturerId', c.manufacturer_id,
    'inventoryGrams', c.inventory_grams,
    'manufacturer', CASE WHEN m.id IS NOT NULL THEN
      json_build_object(
        'id', m.id,
        'name', m.name,
        'emptySpoolWeightG', m.empty_spool_weight_g,
        'fullSpoolNetWeightG', m.full_spool_net_weight_g,
        'lowThresholdG', m.low_threshold_g,
        'criticalThresholdG', m.critical_threshold_g,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at
      )
    ELSE NULL END,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  ) as color
`;

function parseRow(row: Record<string, unknown>): ItemColor {
  return {
    ...row,
    weightGrams: parseFloat((row.weightGrams as string) ?? '0'),
  } as ItemColor;
}

export class LineItemColorModel {
  static async findByLineItem(lineItemId: number): Promise<ItemColor[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS('line_item_colors')} FROM line_item_colors ic ${COLOR_JOIN}
       WHERE ic.line_item_id = $1 ORDER BY ic.is_primary DESC, ic.sort_order ASC`,
      [lineItemId],
    );
    return result.rows.map(parseRow);
  }

  static async findByLineItemIds(lineItemIds: number[]): Promise<Map<number, ItemColor[]>> {
    if (lineItemIds.length === 0) return new Map();
    const result = await pool.query(
      `SELECT ic.line_item_id as "parentId", ${SELECT_FIELDS('line_item_colors')}
       FROM line_item_colors ic ${COLOR_JOIN}
       WHERE ic.line_item_id = ANY($1)
       ORDER BY ic.is_primary DESC, ic.sort_order ASC`,
      [lineItemIds],
    );
    const map = new Map<number, ItemColor[]>();
    for (const row of result.rows) {
      const parentId = row.parentId as number;
      const { parentId: _p, ...rest } = row;
      const list = map.get(parentId) ?? [];
      list.push(parseRow(rest));
      map.set(parentId, list);
    }
    return map;
  }

  static async setColors(lineItemId: number, colors: ItemColorDto[]): Promise<ItemColor[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM line_item_colors WHERE line_item_id = $1', [lineItemId]);

      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        await client.query(
          `INSERT INTO line_item_colors (line_item_id, color_id, is_primary, note, sort_order, weight_grams)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [lineItemId, c.colorId, c.isPrimary, c.note ?? null, c.sortOrder ?? i, c.weightGrams ?? 0],
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

// QueueItemColorModel removed in BuildPlan #6 Phase 3 — queue_item_colors
// table dropped in migration 033.

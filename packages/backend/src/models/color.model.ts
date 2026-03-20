import { pool } from '../config/database.js';
import type { Color, CreateColorDto, UpdateColorDto } from '@wizqueue/shared';

const SELECT_FIELDS = `
  c.id, c.name, c.hex, c.active,
  c.sort_order as "sortOrder",
  c.manufacturer_id as "manufacturerId",
  c.inventory_grams as "inventoryGrams",
  c.created_at as "createdAt",
  c.updated_at as "updatedAt",
  CASE WHEN m.id IS NOT NULL THEN
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
  ELSE NULL END as manufacturer
`;

function parseRow(row: Record<string, unknown>): Color {
  return {
    ...row,
    inventoryGrams: parseFloat(row.inventoryGrams as string ?? '0'),
  } as Color;
}

export class ColorModel {
  static async findAll(activeOnly = false): Promise<Color[]> {
    const where = activeOnly ? 'WHERE c.active = true' : '';
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       ${where}
       ORDER BY c.sort_order ASC, c.name ASC`,
    );
    return result.rows.map(parseRow);
  }

  static async findById(id: number): Promise<Color | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       WHERE c.id = $1`,
      [id],
    );
    return result.rows[0] ? parseRow(result.rows[0]) : null;
  }

  static async create(data: CreateColorDto): Promise<Color> {
    const result = await pool.query(
      `INSERT INTO colors (name, hex, active, sort_order, manufacturer_id, inventory_grams)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.name, data.hex, data.active ?? true, data.sortOrder ?? 0, data.manufacturerId ?? null, data.inventoryGrams ?? 0],
    );
    return (await this.findById(result.rows[0].id))!;
  }

  static async update(id: number, data: UpdateColorDto): Promise<Color | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.hex !== undefined) { fields.push(`hex = $${i++}`); values.push(data.hex); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sortOrder); }
    if (data.manufacturerId !== undefined) { fields.push(`manufacturer_id = $${i++}`); values.push(data.manufacturerId ?? null); }
    if (data.inventoryGrams !== undefined) { fields.push(`inventory_grams = $${i++}`); values.push(data.inventoryGrams); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE colors SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`,
      values,
    );
    if (!result.rows[0]) return null;
    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM colors WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // Add a full spool's net weight to a color's inventory
  static async addSpool(colorId: number): Promise<Color | null> {
    // Get manufacturer's net weight for this color (default 1000g if no manufacturer)
    const mfgResult = await pool.query(
      `SELECT COALESCE(m.full_spool_net_weight_g, 1000) as net_weight
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       WHERE c.id = $1`,
      [colorId],
    );
    if (!mfgResult.rows[0]) return null;
    const netWeight = parseFloat(mfgResult.rows[0].net_weight);
    await pool.query(
      `UPDATE colors SET inventory_grams = inventory_grams + $1, updated_at = NOW() WHERE id = $2`,
      [netWeight, colorId],
    );
    return this.findById(colorId);
  }

  // Deduct grams from inventory (can go negative — warning only, allowed)
  static async deductInventory(colorId: number, grams: number): Promise<void> {
    await pool.query(
      `UPDATE colors SET inventory_grams = inventory_grams - $1, updated_at = NOW() WHERE id = $2`,
      [grams, colorId],
    );
  }
}

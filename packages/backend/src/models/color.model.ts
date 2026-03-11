import { pool } from '../config/database.js';
import type { Color, CreateColorDto, UpdateColorDto } from '@wizqueue/shared';

const SELECT_FIELDS = `
  id, name, hex, active,
  sort_order as "sortOrder",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

export class ColorModel {
  static async findAll(activeOnly = false): Promise<Color[]> {
    const where = activeOnly ? 'WHERE active = true' : '';
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM colors ${where} ORDER BY sort_order ASC, name ASC`,
    );
    return result.rows;
  }

  static async findById(id: number): Promise<Color | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM colors WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(data: CreateColorDto): Promise<Color> {
    const result = await pool.query(
      `INSERT INTO colors (name, hex, active, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_FIELDS}`,
      [data.name, data.hex, data.active ?? true, data.sortOrder ?? 0],
    );
    return result.rows[0];
  }

  static async update(id: number, data: UpdateColorDto): Promise<Color | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.hex !== undefined) { fields.push(`hex = $${i++}`); values.push(data.hex); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sortOrder); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE colors SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM colors WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

import { pool } from '../config/database.js';
import type { Printer, CreatePrinterDto, UpdatePrinterDto } from '@wizqueue/shared';

const SELECT_FIELDS = `id, name, model, active, sort_order as "sortOrder", created_at as "createdAt"`;

export class PrinterModel {
  static async findAll(): Promise<Printer[]> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM printers ORDER BY sort_order ASC, name ASC`);
    return result.rows;
  }

  static async findActive(): Promise<Printer[]> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM printers WHERE active = true ORDER BY sort_order ASC, name ASC`);
    return result.rows;
  }

  static async findById(id: number): Promise<Printer | null> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM printers WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async create(data: CreatePrinterDto): Promise<Printer> {
    const result = await pool.query(
      `INSERT INTO printers (name, model, active, sort_order) VALUES ($1, $2, $3, $4) RETURNING ${SELECT_FIELDS}`,
      [data.name, data.model || null, data.active ?? true, data.sortOrder ?? 0],
    );
    return result.rows[0];
  }

  static async update(id: number, data: UpdatePrinterDto): Promise<Printer | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (data.name !== undefined) { fields.push(`name = $${p++}`); values.push(data.name); }
    if (data.model !== undefined) { fields.push(`model = $${p++}`); values.push(data.model ?? null); }
    if (data.active !== undefined) { fields.push(`active = $${p++}`); values.push(data.active); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${p++}`); values.push(data.sortOrder); }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const result = await pool.query(
      `UPDATE printers SET ${fields.join(', ')} WHERE id = $${p} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM printers WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

import { pool } from '../config/database.js';
import type { Printer, CreatePrinterDto, UpdatePrinterDto } from '@wizqueue/shared';

// Public fields — access_code intentionally excluded
const SELECT_FIELDS = `
  id, name, model, active,
  sort_order    as "sortOrder",
  ip_address    as "ipAddress",
  serial_number as "serialNumber",
  badge_color   as "badgeColor",
  created_at    as "createdAt"
`;

// Full config including access_code — only for internal/service-token callers
const SELECT_FIELDS_WITH_SECRETS = `
  ${SELECT_FIELDS.trim()},
  access_code as "accessCode"
`;

export class PrinterModel {
  static async findAll(): Promise<Printer[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM printers ORDER BY sort_order ASC, name ASC`,
    );
    return result.rows;
  }

  static async findActive(): Promise<Printer[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM printers WHERE active = true ORDER BY sort_order ASC, name ASC`,
    );
    return result.rows;
  }

  static async findAllWithSecrets(): Promise<(Printer & { accessCode: string | null })[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS_WITH_SECRETS} FROM printers WHERE active = true ORDER BY sort_order ASC, name ASC`,
    );
    return result.rows;
  }

  static async findById(id: number): Promise<Printer | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM printers WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(data: CreatePrinterDto): Promise<Printer> {
    const result = await pool.query(
      `INSERT INTO printers (name, model, active, sort_order, ip_address, serial_number, access_code, badge_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_FIELDS}`,
      [
        data.name,
        data.model || null,
        data.active ?? true,
        data.sortOrder ?? 0,
        data.ipAddress || null,
        data.serialNumber || null,
        data.accessCode || null,
        data.badgeColor || null,
      ],
    );
    return result.rows[0];
  }

  static async update(id: number, data: UpdatePrinterDto): Promise<Printer | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (data.name !== undefined)         { fields.push(`name = $${p++}`);          values.push(data.name); }
    if (data.model !== undefined)        { fields.push(`model = $${p++}`);         values.push(data.model ?? null); }
    if (data.active !== undefined)       { fields.push(`active = $${p++}`);        values.push(data.active); }
    if (data.sortOrder !== undefined)    { fields.push(`sort_order = $${p++}`);    values.push(data.sortOrder); }
    if (data.ipAddress !== undefined)    { fields.push(`ip_address = $${p++}`);    values.push(data.ipAddress || null); }
    if (data.serialNumber !== undefined) { fields.push(`serial_number = $${p++}`); values.push(data.serialNumber || null); }
    if (data.accessCode !== undefined)   { fields.push(`access_code = $${p++}`);   values.push(data.accessCode || null); }
    if (data.badgeColor !== undefined)   { fields.push(`badge_color = $${p++}`);   values.push(data.badgeColor || null); }
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

import { pool } from '../config/database.js';
import type { Manufacturer, CreateManufacturerDto, UpdateManufacturerDto } from '@wizqueue/shared';

const SELECT = `
  id, name,
  empty_spool_weight_g as "emptySpoolWeightG",
  full_spool_net_weight_g as "fullSpoolNetWeightG",
  low_threshold_g as "lowThresholdG",
  critical_threshold_g as "criticalThresholdG",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

function parse(row: Record<string, unknown>): Manufacturer {
  return {
    ...row,
    emptySpoolWeightG: parseFloat(row.emptySpoolWeightG as string),
    fullSpoolNetWeightG: parseFloat(row.fullSpoolNetWeightG as string),
    lowThresholdG: parseFloat(row.lowThresholdG as string),
    criticalThresholdG: parseFloat(row.criticalThresholdG as string),
  } as Manufacturer;
}

export class ManufacturerModel {
  static async findAll(): Promise<Manufacturer[]> {
    const result = await pool.query(`SELECT ${SELECT} FROM manufacturers ORDER BY name ASC`);
    return result.rows.map(parse);
  }

  static async findById(id: number): Promise<Manufacturer | null> {
    const result = await pool.query(`SELECT ${SELECT} FROM manufacturers WHERE id = $1`, [id]);
    return result.rows[0] ? parse(result.rows[0]) : null;
  }

  static async create(data: CreateManufacturerDto): Promise<Manufacturer> {
    const result = await pool.query(
      `INSERT INTO manufacturers (name, empty_spool_weight_g, full_spool_net_weight_g, low_threshold_g, critical_threshold_g)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT}`,
      [
        data.name,
        data.emptySpoolWeightG,
        data.fullSpoolNetWeightG,
        data.lowThresholdG ?? 500,
        data.criticalThresholdG ?? 200,
      ],
    );
    return parse(result.rows[0]);
  }

  static async update(id: number, data: UpdateManufacturerDto): Promise<Manufacturer | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.emptySpoolWeightG !== undefined) { fields.push(`empty_spool_weight_g = $${i++}`); values.push(data.emptySpoolWeightG); }
    if (data.fullSpoolNetWeightG !== undefined) { fields.push(`full_spool_net_weight_g = $${i++}`); values.push(data.fullSpoolNetWeightG); }
    if (data.lowThresholdG !== undefined) { fields.push(`low_threshold_g = $${i++}`); values.push(data.lowThresholdG); }
    if (data.criticalThresholdG !== undefined) { fields.push(`critical_threshold_g = $${i++}`); values.push(data.criticalThresholdG); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE manufacturers SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT}`,
      values,
    );
    return result.rows[0] ? parse(result.rows[0]) : null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM manufacturers WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

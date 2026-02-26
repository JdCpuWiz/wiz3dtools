import { pool } from '../config/database.js';
import type { Product, CreateProductDto, UpdateProductDto } from '@wizqueue/shared';

const SELECT = `
  id, name, description, unit_price as "unitPrice",
  units_sold as "unitsSold", active,
  created_at as "createdAt", updated_at as "updatedAt"
`;

export class ProductModel {
  static async findAll(activeOnly = false): Promise<Product[]> {
    const where = activeOnly ? 'WHERE active = TRUE' : '';
    const result = await pool.query(`SELECT ${SELECT} FROM products ${where} ORDER BY name ASC`);
    return result.rows.map(r => ({ ...r, unitPrice: parseFloat(r.unitPrice) }));
  }

  static async findById(id: number): Promise<Product | null> {
    const result = await pool.query(`SELECT ${SELECT} FROM products WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice) };
  }

  static async create(data: CreateProductDto): Promise<Product> {
    const result = await pool.query(
      `INSERT INTO products (name, description, unit_price, active)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT}`,
      [data.name, data.description || null, data.unitPrice, data.active ?? true],
    );
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice) };
  }

  static async update(id: number, data: UpdateProductDto): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${i++}`); values.push(data.description ?? null); }
    if (data.unitPrice !== undefined) { fields.push(`unit_price = $${i++}`); values.push(data.unitPrice); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT}`,
      values,
    );
    if (!result.rows[0]) return null;
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice) };
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  static async incrementSold(id: number, qty: number): Promise<void> {
    await pool.query(
      'UPDATE products SET units_sold = units_sold + $1, updated_at = NOW() WHERE id = $2',
      [qty, id],
    );
  }
}

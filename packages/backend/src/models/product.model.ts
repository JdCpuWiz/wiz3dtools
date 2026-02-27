import { pool } from '../config/database.js';
import type { Product, CreateProductDto, UpdateProductDto } from '@wizqueue/shared';

const SELECT = `
  id, name, description, sku, unit_price as "unitPrice",
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
      `INSERT INTO products (name, description, sku, unit_price, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT}`,
      [data.name, data.description || null, data.sku || null, data.unitPrice, data.active ?? true],
    );
    return { ...result.rows[0], unitPrice: parseFloat(result.rows[0].unitPrice) };
  }

  static async update(id: number, data: UpdateProductDto): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${i++}`); values.push(data.description ?? null); }
    if (data.sku !== undefined) { fields.push(`sku = $${i++}`); values.push(data.sku || null); }
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
    const check = await pool.query(
      'SELECT COUNT(*) AS count FROM invoice_line_items WHERE product_id = $1',
      [id],
    );
    if (parseInt(check.rows[0].count, 10) > 0) {
      const err = new Error('Product is used in invoices and cannot be deleted. Mark it as inactive instead.');
      (err as any).statusCode = 409;
      throw err;
    }
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  static async incrementSold(id: number, qty: number): Promise<void> {
    await pool.query(
      'UPDATE products SET units_sold = units_sold + $1, updated_at = NOW() WHERE id = $2',
      [qty, id],
    );
  }

  static async suggestSku(name: string, excludeId?: number): Promise<string> {
    // Build prefix from first char of each alpha word in the name
    const words = name.split(/[\s\-_]+/).filter((w) => /[a-zA-Z]/.test(w));
    const prefix = words.map((w) => w.replace(/[^a-zA-Z]/g, '')[0] || '').join('').toUpperCase() || 'SKU';

    const pattern = `${prefix}-%`;
    const excludeClause = excludeId ? `AND id != ${excludeId}` : '';
    const result = await pool.query(
      `SELECT sku FROM products WHERE sku LIKE $1 ${excludeClause} ORDER BY sku DESC LIMIT 1`,
      [pattern],
    );

    if (!result.rows[0] || !result.rows[0].sku) {
      return `${prefix}-001`;
    }

    const lastSku: string = result.rows[0].sku;
    const lastNum = parseInt(lastSku.split('-').pop() || '0', 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }
}

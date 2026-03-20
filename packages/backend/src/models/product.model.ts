import { pool } from '../config/database.js';
import type { Product, CreateProductDto, UpdateProductDto } from '@wizqueue/shared';
import { ProductColorModel } from './product-color.model.js';

const SELECT = `
  id, name, description, sku, unit_price as "unitPrice",
  units_sold as "unitsSold", active,
  created_at as "createdAt", updated_at as "updatedAt"
`;

async function attachColors(rows: Record<string, unknown>[]): Promise<Product[]> {
  return Promise.all(
    rows.map(async (r) => {
      const colors = await ProductColorModel.findByProduct(r.id as number);
      const totalWeightGrams = colors.reduce((sum, c) => sum + c.weightGrams, 0);
      return {
        ...r,
        unitPrice: parseFloat(r.unitPrice as string),
        colors,
        totalWeightGrams,
      } as Product;
    }),
  );
}

export class ProductModel {
  static async findAll(activeOnly = false): Promise<Product[]> {
    const where = activeOnly ? 'WHERE active = TRUE' : '';
    const result = await pool.query(`SELECT ${SELECT} FROM products ${where} ORDER BY name ASC`);
    return attachColors(result.rows);
  }

  static async findById(id: number): Promise<Product | null> {
    const result = await pool.query(`SELECT ${SELECT} FROM products WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    const [product] = await attachColors([result.rows[0]]);
    return product;
  }

  static async create(data: CreateProductDto): Promise<Product> {
    const result = await pool.query(
      `INSERT INTO products (name, description, sku, unit_price, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT}`,
      [data.name, data.description || null, data.sku || null, data.unitPrice, data.active ?? true],
    );
    const [product] = await attachColors([result.rows[0]]);
    return product;
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
    const [product] = await attachColors([result.rows[0]]);
    return product;
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

  static async recalcSoldFromShippedInvoices(productIds: number[]): Promise<void> {
    if (productIds.length === 0) return;
    await pool.query(
      `UPDATE products p
       SET units_sold = sub.total, updated_at = NOW()
       FROM (
         SELECT ili.product_id, COALESCE(SUM(ili.quantity), 0) AS total
         FROM invoice_line_items ili
         JOIN sales_invoices si ON si.id = ili.invoice_id
         WHERE ili.product_id = ANY($1)
           AND si.shipped_at IS NOT NULL
         GROUP BY ili.product_id
       ) sub
       WHERE p.id = sub.product_id`,
      [productIds],
    );
  }

  static async suggestSku(name: string, excludeId?: number): Promise<string> {
    const words = name.split(/[\s\-_]+/).filter((w) => /[a-zA-Z]/.test(w));
    const prefix = words.map((w) => w.replace(/[^a-zA-Z]/g, '')[0] || '').join('').toUpperCase() || 'SKU';

    const pattern = `${prefix}-%`;
    const result = excludeId
      ? await pool.query(`SELECT sku FROM products WHERE sku LIKE $1 AND id != $2 ORDER BY sku DESC LIMIT 1`, [pattern, excludeId])
      : await pool.query(`SELECT sku FROM products WHERE sku LIKE $1 ORDER BY sku DESC LIMIT 1`, [pattern]);

    if (!result.rows[0] || !result.rows[0].sku) {
      return `${prefix}-001`;
    }

    const lastSku: string = result.rows[0].sku;
    const lastNum = parseInt(lastSku.split('-').pop() || '0', 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }
}

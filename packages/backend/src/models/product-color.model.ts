import { pool } from '../config/database.js';
import type { ProductColor, ProductColorDto } from '@wizqueue/shared';

const SELECT = `
  pc.id,
  pc.product_id as "productId",
  pc.color_id as "colorId",
  pc.weight_grams as "weightGrams",
  pc.sort_order as "sortOrder",
  json_build_object(
    'id', c.id,
    'name', c.name,
    'hex', c.hex,
    'active', c.active,
    'sortOrder', c.sort_order,
    'manufacturerId', c.manufacturer_id,
    'inventoryGrams', c.inventory_grams,
    'manufacturer', null,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at
  ) as color
`;

function parseRow(row: Record<string, unknown>): ProductColor {
  return {
    ...row,
    weightGrams: parseFloat(row.weightGrams as string),
  } as ProductColor;
}

export class ProductColorModel {
  static async findByProduct(productId: number): Promise<ProductColor[]> {
    const result = await pool.query(
      `SELECT ${SELECT}
       FROM product_colors pc
       JOIN colors c ON c.id = pc.color_id
       WHERE pc.product_id = $1
       ORDER BY pc.sort_order ASC, pc.id ASC`,
      [productId],
    );
    return result.rows.map(parseRow);
  }

  static async setColors(productId: number, colors: ProductColorDto[]): Promise<ProductColor[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM product_colors WHERE product_id = $1', [productId]);

      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        await client.query(
          `INSERT INTO product_colors (product_id, color_id, weight_grams, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (product_id, color_id) DO UPDATE
             SET weight_grams = EXCLUDED.weight_grams, sort_order = EXCLUDED.sort_order`,
          [productId, c.colorId, c.weightGrams, c.sortOrder ?? i],
        );
      }

      await client.query('COMMIT');
      return this.findByProduct(productId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTotalWeightGrams(productId: number): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(weight_grams), 0) as total FROM product_colors WHERE product_id = $1`,
      [productId],
    );
    return parseFloat(result.rows[0].total);
  }
}

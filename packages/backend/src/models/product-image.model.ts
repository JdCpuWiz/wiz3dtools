import { pool } from '../config/database.js';
import type { ProductImage } from '@wizqueue/shared';

const SELECT = `
  id, product_id as "productId", url,
  sort_order as "sortOrder", is_primary as "isPrimary",
  created_at as "createdAt"
`;

export class ProductImageModel {
  static async findByProduct(productId: number): Promise<ProductImage[]> {
    const result = await pool.query(
      `SELECT ${SELECT} FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC`,
      [productId],
    );
    return result.rows as ProductImage[];
  }

  static async create(productId: number, url: string, isPrimary = false): Promise<ProductImage> {
    // If this is the first image, make it primary automatically
    const countResult = await pool.query(
      'SELECT COUNT(*) AS count FROM product_images WHERE product_id = $1',
      [productId],
    );
    const isFirst = parseInt(countResult.rows[0].count, 10) === 0;
    const shouldBePrimary = isPrimary || isFirst;

    const sortResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1',
      [productId],
    );
    const sortOrder = sortResult.rows[0].next as number;

    const result = await pool.query(
      `INSERT INTO product_images (product_id, url, sort_order, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT}`,
      [productId, url, sortOrder, shouldBePrimary],
    );
    return result.rows[0] as ProductImage;
  }

  static async setPrimary(productId: number, imageId: number): Promise<boolean> {
    // Clear existing primary then set the new one
    await pool.query(
      'UPDATE product_images SET is_primary = FALSE WHERE product_id = $1',
      [productId],
    );
    const result = await pool.query(
      'UPDATE product_images SET is_primary = TRUE WHERE id = $1 AND product_id = $2',
      [imageId, productId],
    );
    return (result.rowCount || 0) > 0;
  }

  static async reorder(productId: number, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query(
        'UPDATE product_images SET sort_order = $1 WHERE id = $2 AND product_id = $3',
        [i, orderedIds[i], productId],
      );
    }
  }

  static async delete(productId: number, imageId: number): Promise<{ url: string } | null> {
    const result = await pool.query(
      'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url, is_primary as "isPrimary"',
      [imageId, productId],
    );
    if (!result.rows[0]) return null;

    // If we deleted the primary, promote the lowest sort_order remaining image
    if (result.rows[0].isPrimary) {
      await pool.query(
        `UPDATE product_images SET is_primary = TRUE
         WHERE id = (SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1)`,
        [productId],
      );
    }

    return { url: result.rows[0].url as string };
  }
}

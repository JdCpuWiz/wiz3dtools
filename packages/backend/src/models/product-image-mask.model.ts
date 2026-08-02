import { pool } from '../config/database.js';
import type { ProductImageMask } from '@wizqueue/shared';

const SELECT = `
  id, image_id as "imageId", slot_index as "slotIndex",
  url, source, created_at as "createdAt"
`;

export class ProductImageMaskModel {
  static async findByImage(imageId: number): Promise<ProductImageMask[]> {
    const result = await pool.query(
      `SELECT ${SELECT} FROM product_image_masks WHERE image_id = $1 ORDER BY slot_index ASC`,
      [imageId],
    );
    return result.rows as ProductImageMask[];
  }

  static async findByImageIds(imageIds: number[]): Promise<Map<number, ProductImageMask[]>> {
    const map = new Map<number, ProductImageMask[]>();
    if (imageIds.length === 0) return map;
    const result = await pool.query(
      `SELECT ${SELECT} FROM product_image_masks WHERE image_id = ANY($1) ORDER BY slot_index ASC`,
      [imageIds],
    );
    for (const row of result.rows as ProductImageMask[]) {
      const list = map.get(row.imageId) ?? [];
      list.push(row);
      map.set(row.imageId, list);
    }
    return map;
  }

  /** Replace-or-create the mask for one (image, slot). Returns the old url when replacing so the caller can unlink the stale file. */
  static async upsert(
    imageId: number,
    slotIndex: number,
    url: string,
    source: ProductImageMask['source'],
  ): Promise<{ mask: ProductImageMask; previousUrl: string | null }> {
    const prev = await pool.query(
      'SELECT url FROM product_image_masks WHERE image_id = $1 AND slot_index = $2',
      [imageId, slotIndex],
    );
    const result = await pool.query(
      `INSERT INTO product_image_masks (image_id, slot_index, url, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (image_id, slot_index)
       DO UPDATE SET url = EXCLUDED.url, source = EXCLUDED.source, created_at = NOW()
       RETURNING ${SELECT}`,
      [imageId, slotIndex, url, source],
    );
    return {
      mask: result.rows[0] as ProductImageMask,
      previousUrl: (prev.rows[0]?.url as string) ?? null,
    };
  }

  /**
   * Images of single-color products (exactly one recipe slot) that have no
   * slot-0 mask yet — the bulk-generate work list.
   */
  static async findUnmaskedSingleColorImages(): Promise<
    { imageId: number; url: string; productId: number; productName: string }[]
  > {
    const result = await pool.query(
      `SELECT pi.id as "imageId", pi.url, p.id as "productId", p.name as "productName"
       FROM product_images pi
       JOIN products p ON p.id = pi.product_id
       WHERE (SELECT COUNT(*) FROM product_colors pc WHERE pc.product_id = p.id) = 1
         AND NOT EXISTS (
           SELECT 1 FROM product_image_masks m
           WHERE m.image_id = pi.id AND m.slot_index = 0
         )
       ORDER BY p.name ASC, pi.sort_order ASC`,
    );
    return result.rows;
  }
}

import { pool } from '../config/database.js';
import type { Product, CreateProductDto, UpdateProductDto, ProductImage, Category } from '@wizqueue/shared';
import { ProductColorModel } from './product-color.model.js';

const SELECT = `
  id, name, description, sku, unit_price as "unitPrice",
  units_sold as "unitsSold", active,
  published_to_store as "publishedToStore",
  category_id as "categoryId",
  store_title as "storeTitle",
  store_description as "storeDescription",
  wholesale_price as "wholesalePrice",
  retail_price as "retailPrice",
  created_at as "createdAt", updated_at as "updatedAt"
`;

async function attachImages(productId: number): Promise<ProductImage[]> {
  const result = await pool.query(
    `SELECT id, product_id as "productId", url, sort_order as "sortOrder",
            is_primary as "isPrimary", created_at as "createdAt"
     FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC`,
    [productId],
  );
  return result.rows as ProductImage[];
}

async function attachCategory(categoryId: number | null): Promise<Category | null> {
  if (!categoryId) return null;
  const result = await pool.query(
    `SELECT id, name, slug, description, sort_order as "sortOrder",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM categories WHERE id = $1`,
    [categoryId],
  );
  return (result.rows[0] as Category) ?? null;
}

async function attachColors(rows: Record<string, unknown>[]): Promise<Product[]> {
  return Promise.all(
    rows.map(async (r) => {
      const colors = await ProductColorModel.findByProduct(r.id as number);
      const totalWeightGrams = colors.reduce((sum, c) => sum + c.weightGrams, 0);
      const images = await attachImages(r.id as number);
      const category = await attachCategory(r.categoryId as number | null);
      return {
        ...r,
        unitPrice: parseFloat(r.unitPrice as string),
        wholesalePrice: parseFloat(r.wholesalePrice as string),
        retailPrice: parseFloat(r.retailPrice as string),
        colors,
        totalWeightGrams,
        images,
        category,
      } as Product;
    }),
  );
}

export class ProductModel {
  static async findAll(activeOnly = false): Promise<Product[]> {
    const where = activeOnly ? 'WHERE active = TRUE' : '';
    const result = await pool.query(`SELECT ${SELECT} FROM products ${where} ORDER BY name ASC`);
    if (result.rows.length === 0) return [];
    const productIds = result.rows.map((r) => r.id as number);
    const colorMap = await ProductColorModel.findByProductIds(productIds);

    // Batch-load images
    const imgResult = await pool.query(
      `SELECT id, product_id as "productId", url, sort_order as "sortOrder",
              is_primary as "isPrimary", created_at as "createdAt"
       FROM product_images WHERE product_id = ANY($1) ORDER BY sort_order ASC, id ASC`,
      [productIds],
    );
    const imageMap = new Map<number, ProductImage[]>();
    for (const img of imgResult.rows as ProductImage[]) {
      const list = imageMap.get(img.productId) ?? [];
      list.push(img);
      imageMap.set(img.productId, list);
    }

    // Batch-load categories
    const catIds = [...new Set(result.rows.map((r) => r.categoryId as number | null).filter(Boolean))] as number[];
    const catMap = new Map<number, Category>();
    if (catIds.length > 0) {
      const catResult = await pool.query(
        `SELECT id, name, slug, description, sort_order as "sortOrder",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM categories WHERE id = ANY($1)`,
        [catIds],
      );
      for (const cat of catResult.rows as Category[]) {
        catMap.set(cat.id, cat);
      }
    }

    return result.rows.map((r) => {
      const colors = colorMap.get(r.id as number) ?? [];
      return {
        ...r,
        unitPrice: parseFloat(r.unitPrice as string),
        wholesalePrice: parseFloat(r.wholesalePrice as string),
        retailPrice: parseFloat(r.retailPrice as string),
        colors,
        totalWeightGrams: colors.reduce((sum, c) => sum + c.weightGrams, 0),
        images: imageMap.get(r.id as number) ?? [],
        category: r.categoryId ? (catMap.get(r.categoryId as number) ?? null) : null,
      } as Product;
    });
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
    if (data.publishedToStore !== undefined) { fields.push(`published_to_store = $${i++}`); values.push(data.publishedToStore); }
    if (data.categoryId !== undefined) { fields.push(`category_id = $${i++}`); values.push(data.categoryId ?? null); }
    if (data.storeTitle !== undefined) { fields.push(`store_title = $${i++}`); values.push(data.storeTitle ?? null); }
    if (data.storeDescription !== undefined) { fields.push(`store_description = $${i++}`); values.push(data.storeDescription ?? null); }
    if (data.wholesalePrice !== undefined) { fields.push(`wholesale_price = $${i++}`); values.push(data.wholesalePrice); }
    if (data.retailPrice !== undefined) { fields.push(`retail_price = $${i++}`); values.push(data.retailPrice); }

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

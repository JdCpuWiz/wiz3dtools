import { pool } from '../config/database.js';
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '@wizqueue/shared';

const SELECT = `
  id, name, slug, description,
  sort_order as "sortOrder",
  created_at as "createdAt", updated_at as "updatedAt"
`;

export class CategoryModel {
  static async findAll(): Promise<Category[]> {
    const result = await pool.query(
      `SELECT ${SELECT} FROM categories ORDER BY sort_order ASC, name ASC`,
    );
    return result.rows as Category[];
  }

  static async findById(id: number): Promise<Category | null> {
    const result = await pool.query(
      `SELECT ${SELECT} FROM categories WHERE id = $1`,
      [id],
    );
    return (result.rows[0] as Category) ?? null;
  }

  static async findBySlug(slug: string): Promise<Category | null> {
    const result = await pool.query(
      `SELECT ${SELECT} FROM categories WHERE slug = $1`,
      [slug],
    );
    return (result.rows[0] as Category) ?? null;
  }

  static async create(data: CreateCategoryDto): Promise<Category> {
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT}`,
      [data.name, data.slug, data.description ?? null, data.sortOrder ?? 0],
    );
    return result.rows[0] as Category;
  }

  static async update(id: number, data: UpdateCategoryDto): Promise<Category | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.slug !== undefined) { fields.push(`slug = $${i++}`); values.push(data.slug); }
    if (data.description !== undefined) { fields.push(`description = $${i++}`); values.push(data.description ?? null); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sortOrder); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT}`,
      values,
    );
    return (result.rows[0] as Category) ?? null;
  }

  static async delete(id: number): Promise<boolean> {
    // Unlink any products first (category_id has ON DELETE SET NULL)
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

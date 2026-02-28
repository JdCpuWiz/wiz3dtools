import { pool } from '../config/database.js';
import type { User } from '@wizqueue/shared';

const SELECT_FIELDS = `
  id, username, email, role,
  created_at as "createdAt", updated_at as "updatedAt"
`;

export interface UserWithHash extends User {
  passwordHash: string;
}

export class UserModel {
  static async findByUsername(username: string): Promise<UserWithHash | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}, password_hash as "passwordHash" FROM users WHERE username = $1`,
      [username],
    );
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async countAll(): Promise<number> {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count, 10);
  }

  static async create(data: {
    username: string;
    email?: string;
    passwordHash: string;
    role: string;
  }): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_FIELDS}`,
      [data.username, data.email || null, data.passwordHash, data.role],
    );
    return result.rows[0];
  }

  static async findAll(): Promise<User[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM users ORDER BY created_at ASC`,
    );
    return result.rows;
  }

  static async update(id: number, data: { email?: string | null; role?: string }): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.email !== undefined) {
      fields.push(`email = $${i++}`);
      values.push(data.email ?? null);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${i++}`);
      values.push(data.role);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    return result.rows[0] || null;
  }

  static async updatePassword(id: number, passwordHash: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, id],
    );
    return (result.rowCount || 0) > 0;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

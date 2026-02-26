import { pool } from '../config/database.js';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@wizqueue/shared';

const SELECT_FIELDS = `
  id, business_name as "businessName", contact_name as "contactName",
  email, phone, address_line1 as "addressLine1", address_line2 as "addressLine2",
  city, state_province as "stateProvince", postal_code as "postalCode",
  country, notes, created_at as "createdAt", updated_at as "updatedAt"
`;

export class CustomerModel {
  static async findAll(): Promise<Customer[]> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM customers ORDER BY contact_name ASC`);
    return result.rows;
  }

  static async findById(id: number): Promise<Customer | null> {
    const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM customers WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async create(data: CreateCustomerDto): Promise<Customer> {
    const query = `
      INSERT INTO customers (
        business_name, contact_name, email, phone,
        address_line1, address_line2, city, state_province,
        postal_code, country, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${SELECT_FIELDS}
    `;
    const values = [
      data.businessName || null,
      data.contactName,
      data.email || null,
      data.phone || null,
      data.addressLine1 || null,
      data.addressLine2 || null,
      data.city || null,
      data.stateProvince || null,
      data.postalCode || null,
      data.country || 'New Zealand',
      data.notes || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(id: number, data: UpdateCustomerDto): Promise<Customer | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: [keyof UpdateCustomerDto, string][] = [
      ['businessName', 'business_name'],
      ['contactName', 'contact_name'],
      ['email', 'email'],
      ['phone', 'phone'],
      ['addressLine1', 'address_line1'],
      ['addressLine2', 'address_line2'],
      ['city', 'city'],
      ['stateProvince', 'state_province'],
      ['postalCode', 'postal_code'],
      ['country', 'country'],
      ['notes', 'notes'],
    ];

    for (const [key, col] of map) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(data[key] ?? null);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      values,
    );
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

import { pool } from '../config/database.js';
import type { SalesInvoice, SalesInvoiceStatus, CreateSalesInvoiceDto, UpdateSalesInvoiceDto } from '@wizqueue/shared';
import { InvoiceLineItemModel } from './invoice-line-item.model.js';

const INVOICE_SELECT = `
  si.id, si.invoice_number as "invoiceNumber", si.customer_id as "customerId",
  si.status, si.tax_rate as "taxRate", si.tax_exempt as "taxExempt",
  si.notes, si.due_date as "dueDate", si.sent_at as "sentAt",
  si.created_at as "createdAt", si.updated_at as "updatedAt"
`;

const CUSTOMER_SELECT = `
  c.id as "c_id", c.business_name as "c_businessName", c.contact_name as "c_contactName",
  c.email as "c_email", c.phone as "c_phone",
  c.address_line1 as "c_addressLine1", c.address_line2 as "c_addressLine2",
  c.city as "c_city", c.state_province as "c_stateProvince",
  c.postal_code as "c_postalCode", c.country as "c_country",
  c.notes as "c_notes", c.created_at as "c_createdAt", c.updated_at as "c_updatedAt"
`;

function mapRow(row: Record<string, unknown>): Omit<SalesInvoice, 'lineItems'> {
  const inv = {
    id: row.id as number,
    invoiceNumber: row.invoiceNumber as string,
    customerId: row.customerId as number | null,
    status: row.status as SalesInvoiceStatus,
    taxRate: parseFloat(row.taxRate as string),
    taxExempt: row.taxExempt as boolean,
    notes: row.notes as string | null,
    dueDate: row.dueDate ? (row.dueDate as Date).toISOString().split('T')[0] : null,
    sentAt: row.sentAt as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    customer: row.c_id
      ? {
          id: row.c_id as number,
          businessName: row.c_businessName as string | null,
          contactName: row.c_contactName as string,
          email: row.c_email as string | null,
          phone: row.c_phone as string | null,
          addressLine1: row.c_addressLine1 as string | null,
          addressLine2: row.c_addressLine2 as string | null,
          city: row.c_city as string | null,
          stateProvince: row.c_stateProvince as string | null,
          postalCode: row.c_postalCode as string | null,
          country: row.c_country as string,
          notes: row.c_notes as string | null,
          createdAt: row.c_createdAt as string,
          updatedAt: row.c_updatedAt as string,
        }
      : null,
  };
  return inv;
}

export class SalesInvoiceModel {
  static async getNextInvoiceNumber(): Promise<string> {
    const result = await pool.query(`SELECT nextval('sales_invoice_number_seq') as n`);
    const n = parseInt(result.rows[0].n);
    return `INV-${String(n).padStart(4, '0')}`;
  }

  static async findAll(): Promise<SalesInvoice[]> {
    const result = await pool.query(`
      SELECT ${INVOICE_SELECT}, ${CUSTOMER_SELECT}
      FROM sales_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      ORDER BY si.created_at DESC
    `);

    const invoices = await Promise.all(
      result.rows.map(async (row) => {
        const lineItems = await InvoiceLineItemModel.findByInvoice(row.id as number);
        return { ...mapRow(row), lineItems };
      }),
    );
    return invoices;
  }

  static async findById(id: number): Promise<SalesInvoice | null> {
    const result = await pool.query(
      `SELECT ${INVOICE_SELECT}, ${CUSTOMER_SELECT}
       FROM sales_invoices si
       LEFT JOIN customers c ON si.customer_id = c.id
       WHERE si.id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    const lineItems = await InvoiceLineItemModel.findByInvoice(id);
    return { ...mapRow(result.rows[0]), lineItems };
  }

  static async create(data: CreateSalesInvoiceDto): Promise<SalesInvoice> {
    const invoiceNumber = await this.getNextInvoiceNumber();
    const result = await pool.query(
      `INSERT INTO sales_invoices (invoice_number, customer_id, tax_rate, tax_exempt, notes, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        invoiceNumber,
        data.customerId || null,
        data.taxRate ?? 0.15,
        data.taxExempt ?? false,
        data.notes || null,
        data.dueDate || null,
      ],
    );
    const id = result.rows[0].id as number;

    // Insert line items if provided
    if (data.lineItems && data.lineItems.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of data.lineItems) {
          await client.query(
            `INSERT INTO invoice_line_items (invoice_id, product_name, details, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, item.productName, item.details || null, item.quantity, item.unitPrice],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    return (await this.findById(id))!;
  }

  static async update(id: number, data: UpdateSalesInvoiceDto): Promise<SalesInvoice | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: [keyof UpdateSalesInvoiceDto, string][] = [
      ['customerId', 'customer_id'],
      ['status', 'status'],
      ['taxRate', 'tax_rate'],
      ['taxExempt', 'tax_exempt'],
      ['notes', 'notes'],
      ['dueDate', 'due_date'],
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

    await pool.query(
      `UPDATE sales_invoices SET ${fields.join(', ')} WHERE id = $${i}`,
      values,
    );
    return this.findById(id);
  }

  static async markSent(id: number): Promise<void> {
    await pool.query(
      `UPDATE sales_invoices SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM sales_invoices WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

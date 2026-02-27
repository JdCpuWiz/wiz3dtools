/**
 * CSV Import Script
 * Usage: node import-csv.js <entity> <file.csv>
 * Entities: customers | products | invoices | line-items
 *
 * Reads .env from packages/backend/.env (or root .env)
 * Column order doesn't matter — mapped by header name.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env (try backend dir first, then repo root)
const envPaths = [
  resolve(__dirname, '.env'),
  resolve(__dirname, '../../.env'),
];
for (const p of envPaths) {
  if (existsSync(p)) { dotenv.config({ path: p }); break; }
}

// ── DB connection ───────────────────────────────────────────────────────────
const pool = new pg.Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

// ── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    rows.push(fields);
  }
  return rows;
}

function toRecords(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  return rows.slice(1).map(row => {
    const rec = {};
    headers.forEach((h, i) => { rec[h] = row[i] ?? ''; });
    return rec;
  });
}

// ── Header aliases ──────────────────────────────────────────────────────────
function pick(rec, ...aliases) {
  for (const a of aliases) {
    const v = rec[a.toLowerCase().replace(/\s+/g, '_')];
    if (v !== undefined && v !== '') return v;
  }
  return null;
}

function toBool(v) {
  if (v === null || v === undefined || v === '') return null;
  return ['true', 'yes', 'y', '1', 'active'].includes(String(v).toLowerCase());
}

function toFloat(v) {
  if (v === null || v === '') return null;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ── Importers ───────────────────────────────────────────────────────────────

async function importCustomers(records) {
  console.log(`\nImporting ${records.length} customers…`);
  let ok = 0, skip = 0, err = 0;
  for (const r of records) {
    const contactName = pick(r, 'contact_name', 'name', 'full_name', 'customer_name', 'contact');
    const businessName = pick(r, 'business_name', 'company', 'company_name', 'business', 'organisation', 'organization');
    if (!contactName && !businessName) {
      console.warn('  SKIP (no name):', JSON.stringify(r));
      skip++; continue;
    }
    try {
      await pool.query(`
        INSERT INTO customers
          (contact_name, business_name, email, phone,
           address_line1, address_line2, city, state_province,
           postal_code, country, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        contactName || businessName,
        businessName || null,
        pick(r, 'email', 'email_address') || null,
        pick(r, 'phone', 'phone_number', 'telephone', 'mobile', 'cell') || null,
        pick(r, 'address_line1', 'address1', 'address', 'street', 'street_address') || null,
        pick(r, 'address_line2', 'address2', 'suite', 'apt', 'unit') || null,
        pick(r, 'city', 'town', 'suburb') || null,
        pick(r, 'state_province', 'state', 'province', 'region') || null,
        pick(r, 'postal_code', 'zip', 'zip_code', 'postcode') || null,
        pick(r, 'country') || 'New Zealand',
        pick(r, 'notes', 'comments', 'additional_notes') || null,
      ]);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message, '→', JSON.stringify(r));
      err++;
    }
  }
  console.log(`  Done: ${ok} inserted, ${skip} skipped, ${err} errors`);
}

async function importProducts(records) {
  console.log(`\nImporting ${records.length} products…`);
  let ok = 0, skip = 0, err = 0;
  for (const r of records) {
    const name = pick(r, 'name', 'product_name', 'item_name', 'product', 'title', 'item');
    if (!name) { console.warn('  SKIP (no name):', JSON.stringify(r)); skip++; continue; }
    const priceRaw = pick(r, 'unit_price', 'price', 'unit_cost', 'cost', 'amount', 'rate');
    const price = toFloat(priceRaw) ?? 0;
    const activeRaw = pick(r, 'active', 'is_active', 'enabled', 'status');
    const active = activeRaw !== null ? (toBool(activeRaw) ?? true) : true;
    try {
      await pool.query(`
        INSERT INTO products (name, description, sku, unit_price, active)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (sku) WHERE sku IS NOT NULL DO UPDATE
          SET name = EXCLUDED.name,
              description = EXCLUDED.description,
              unit_price = EXCLUDED.unit_price,
              active = EXCLUDED.active
      `, [
        name,
        pick(r, 'description', 'desc', 'details', 'product_description') || null,
        pick(r, 'sku', 'item_code', 'product_code', 'code', 'part_number') || null,
        price,
        active,
      ]);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message, '→', JSON.stringify(r));
      err++;
    }
  }
  console.log(`  Done: ${ok} inserted/updated, ${skip} skipped, ${err} errors`);
}

async function importInvoices(records) {
  console.log(`\nImporting ${records.length} invoices…`);
  let ok = 0, skip = 0, err = 0;

  // Cache customers for lookup by name/email
  const { rows: customers } = await pool.query(
    'SELECT id, contact_name, business_name, email FROM customers'
  );
  const findCustomer = (name, email) => {
    if (!name && !email) return null;
    const norm = s => (s || '').toLowerCase().trim();
    return customers.find(c =>
      (email && norm(c.email) === norm(email)) ||
      (name && (norm(c.contact_name) === norm(name) || norm(c.business_name) === norm(name)))
    ) || null;
  };

  for (const r of records) {
    const customerName = pick(r, 'customer_name', 'customer', 'client', 'client_name', 'bill_to', 'billed_to');
    const customerEmail = pick(r, 'customer_email', 'client_email');
    const customer = findCustomer(customerName, customerEmail);

    const statusRaw = (pick(r, 'status', 'invoice_status') || 'draft').toLowerCase();
    const validStatuses = ['draft', 'sent', 'paid', 'cancelled'];
    const status = validStatuses.includes(statusRaw) ? statusRaw : 'draft';

    const taxRateRaw = pick(r, 'tax_rate', 'tax', 'tax_percent', 'vat', 'gst', 'sales_tax');
    let taxRate = toFloat(taxRateRaw);
    // If stored as percentage (e.g. 7 instead of 0.07) convert it
    if (taxRate !== null && taxRate > 1) taxRate = taxRate / 100;
    taxRate = taxRate ?? 0.07;

    const taxExemptRaw = pick(r, 'tax_exempt', 'exempt', 'tax_free');
    const taxExempt = toBool(taxExemptRaw) ?? false;

    const shipping = toFloat(pick(r, 'shipping', 'shipping_cost', 'freight', 'delivery')) ?? 0;
    const dueDate = toDate(pick(r, 'due_date', 'due', 'payment_due', 'due_by'));
    const notes = pick(r, 'notes', 'comments', 'memo', 'description') || null;

    // Optional: override invoice number (if blank, DB sequence generates one)
    const invoiceNumber = pick(r, 'invoice_number', 'invoice_no', 'inv_number', 'inv_no', 'number');

    try {
      let invNum = invoiceNumber;
      if (!invNum) {
        const seq = await pool.query(`SELECT nextval('sales_invoice_number_seq') as n`);
        invNum = `INV-${String(seq.rows[0].n).padStart(4, '0')}`;
      }

      const { rows: [inv] } = await pool.query(`
        INSERT INTO sales_invoices
          (invoice_number, customer_id, status, tax_rate, tax_exempt,
           shipping_cost, notes, due_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (invoice_number) DO NOTHING
        RETURNING id, invoice_number
      `, [invNum, customer?.id || null, status, taxRate, taxExempt, shipping, notes, dueDate]);

      if (!inv) {
        console.warn(`  SKIP (duplicate invoice_number ${invNum})`);
        skip++; continue;
      }

      // Inline line item fields (single-line-item invoices)
      const itemName = pick(r, 'item_name', 'product_name', 'item', 'product', 'description', 'service');
      const itemQty = toFloat(pick(r, 'quantity', 'qty', 'units')) ?? 1;
      const itemPrice = toFloat(pick(r, 'unit_price', 'price', 'rate', 'unit_cost', 'amount'));
      const itemSku = pick(r, 'sku', 'item_code', 'product_code');

      if (itemName && itemPrice !== null) {
        await pool.query(`
          INSERT INTO invoice_line_items (invoice_id, product_name, sku, quantity, unit_price)
          VALUES ($1,$2,$3,$4,$5)
        `, [inv.id, itemName, itemSku || null, itemQty, itemPrice]);
      }

      console.log(`  OK: ${inv.invoice_number}${customer ? ` → ${customer.contact_name}` : ''}`);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message, '→', JSON.stringify(r));
      err++;
    }
  }
  console.log(`  Done: ${ok} inserted, ${skip} skipped, ${err} errors`);
}

async function importLineItems(records) {
  console.log(`\nImporting ${records.length} line items…`);
  let ok = 0, skip = 0, err = 0;

  // Cache invoice numbers
  const { rows: invoices } = await pool.query('SELECT id, invoice_number FROM sales_invoices');
  const invMap = Object.fromEntries(invoices.map(i => [i.invoice_number.toUpperCase(), i.id]));

  for (const r of records) {
    const invNum = (pick(r, 'invoice_number', 'invoice_no', 'inv_number', 'number') || '').toUpperCase();
    const invoiceId = invMap[invNum];
    if (!invoiceId) {
      console.warn(`  SKIP (invoice not found: ${invNum})`);
      skip++; continue;
    }
    const itemName = pick(r, 'product_name', 'item_name', 'name', 'description', 'item', 'product');
    if (!itemName) { console.warn('  SKIP (no product name)'); skip++; continue; }

    const price = toFloat(pick(r, 'unit_price', 'price', 'rate', 'unit_cost', 'amount'));
    if (price === null) { console.warn(`  SKIP (no price for ${itemName})`); skip++; continue; }

    try {
      await pool.query(`
        INSERT INTO invoice_line_items
          (invoice_id, product_name, sku, details, quantity, unit_price)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [
        invoiceId,
        itemName,
        pick(r, 'sku', 'item_code', 'product_code') || null,
        pick(r, 'details', 'description', 'notes') || null,
        toFloat(pick(r, 'quantity', 'qty', 'units')) ?? 1,
        price,
      ]);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message, '→', JSON.stringify(r));
      err++;
    }
  }
  console.log(`  Done: ${ok} inserted, ${skip} skipped, ${err} errors`);
}

// ── Main ────────────────────────────────────────────────────────────────────
const [,, entity, filePath] = process.argv;

if (!entity || !filePath) {
  console.error('Usage: node import-csv.js <entity> <file.csv>');
  console.error('Entities: customers | products | invoices | line-items');
  process.exit(1);
}

const absPath = resolve(process.cwd(), filePath);
if (!existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

const content = readFileSync(absPath, 'utf8');
const rows = parseCSV(content);
const records = toRecords(rows);

console.log(`File: ${absPath}`);
console.log(`Headers: ${rows[0]?.join(', ')}`);
console.log(`Rows: ${records.length}`);

try {
  switch (entity) {
    case 'customers':   await importCustomers(records); break;
    case 'products':    await importProducts(records); break;
    case 'invoices':    await importInvoices(records); break;
    case 'line-items':  await importLineItems(records); break;
    default:
      console.error(`Unknown entity: ${entity}. Use: customers | products | invoices | line-items`);
      process.exit(1);
  }
} finally {
  await pool.end();
}

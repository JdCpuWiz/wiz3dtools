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

// Load .env — check several locations
const envPaths = [
  resolve(__dirname, '.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../.env.example'),
];
for (const p of envPaths) {
  if (existsSync(p)) { dotenv.config({ path: p }); break; }
}

// ── DB connection (supports DATABASE_URL or individual vars) ─────────────────
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    };
const pool = new pg.Pool(poolConfig);

// ── CSV parser (handles quoted multiline fields) ────────────────────────────
function parseCSV(content) {
  const rows = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else if (ch === '\n' && !inQuotes) {
      fields.push(field.trim());
      if (fields.some(f => f !== '')) rows.push(fields);
      fields = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // last field / last line with no trailing newline
  fields.push(field.trim());
  if (fields.some(f => f !== '')) rows.push(fields);
  return rows;
}

function toRecords(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );
  return rows.slice(1).map(row => {
    const rec = {};
    headers.forEach((h, i) => { rec[h] = row[i] ?? ''; });
    return rec;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function pick(rec, ...aliases) {
  for (const a of aliases) {
    const key = a.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const v = rec[key];
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

/** Normalise invoice numbers: 7 / 07 / 0007 / INV-0007 → INV-0007 */
function normalizeInvNum(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^INV-/i.test(s)) return s.toUpperCase();
  const n = parseInt(s);
  return isNaN(n) ? s.toUpperCase() : `INV-${String(n).padStart(4, '0')}`;
}

// ── Importers ───────────────────────────────────────────────────────────────

async function importCustomers(records) {
  console.log(`\nImporting ${records.length} customers…`);
  let ok = 0, skip = 0, err = 0;
  for (const r of records) {
    // clients.csv: "Name" = business name, "First Name"+"Last Name" = contact
    const businessName =
      pick(r, 'name', 'business_name', 'company', 'company_name', 'organisation', 'organization');
    const firstName = pick(r, 'first_name', 'firstname');
    const lastName  = pick(r, 'last_name', 'lastname');
    let contactName = pick(r, 'contact_name', 'full_name', 'customer_name', 'contact');
    if (!contactName && (firstName || lastName)) {
      contactName = [firstName, lastName].filter(Boolean).join(' ');
    }
    // If only one "name" field and no separate first/last, use it as contact too
    if (!contactName) contactName = businessName;

    if (!contactName && !businessName) {
      console.warn('  SKIP (no name):', JSON.stringify(r));
      skip++; continue;
    }

    // State/Province header normalises to "stateprovince" (slash stripped)
    const state = pick(r, 'stateprovince', 'state_province', 'state', 'province', 'region');
    const phone = pick(r, 'client_phone', 'phone', 'phone_number', 'telephone', 'mobile', 'cell');

    try {
      await pool.query(`
        INSERT INTO customers
          (contact_name, business_name, email, phone,
           address_line1, address_line2, city, state_province,
           postal_code, country, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        contactName,
        businessName !== contactName ? businessName : null,
        pick(r, 'email', 'email_address') || null,
        phone || null,
        pick(r, 'street', 'address_line1', 'address1', 'address', 'street_address') || null,
        pick(r, 'address_line2', 'address2', 'suite', 'apt', 'unit') || null,
        pick(r, 'city', 'town', 'suburb') || null,
        state || null,
        pick(r, 'postal_code', 'zip', 'zip_code', 'postcode') || null,
        pick(r, 'country') || 'USA',
        pick(r, 'notes', 'comments', 'additional_notes') || null,
      ]);
      console.log(`  OK: ${businessName || contactName}`);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message || e, '→', JSON.stringify(r));
      err++;
    }
  }
  console.log(`  Done: ${ok} inserted, ${skip} skipped, ${err} errors`);
}

async function importProducts(records) {
  console.log(`\nImporting ${records.length} products…`);
  let ok = 0, skip = 0, err = 0;
  for (const r of records) {
    const name = pick(r, 'product', 'name', 'product_name', 'item_name', 'item', 'title');
    if (!name) { console.warn('  SKIP (no name):', JSON.stringify(r)); skip++; continue; }
    const priceRaw = pick(r, 'price', 'unit_price', 'unit_cost', 'cost', 'amount', 'rate');
    const price = toFloat(priceRaw) ?? 0;
    const activeRaw = pick(r, 'active', 'is_active', 'enabled', 'status');
    const active = activeRaw !== null ? (toBool(activeRaw) ?? true) : true;
    const sku = pick(r, 'sku', 'item_code', 'product_code', 'code', 'part_number') || null;
    try {
      if (sku) {
        await pool.query(`
          INSERT INTO products (name, description, sku, unit_price, active)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (sku) WHERE sku IS NOT NULL DO UPDATE
            SET name = EXCLUDED.name,
                description = EXCLUDED.description,
                unit_price = EXCLUDED.unit_price,
                active = EXCLUDED.active
        `, [name, pick(r, 'notes', 'description', 'desc', 'details') || null, sku, price, active]);
      } else {
        await pool.query(`
          INSERT INTO products (name, description, sku, unit_price, active)
          VALUES ($1,$2,$3,$4,$5)
        `, [name, pick(r, 'notes', 'description', 'desc', 'details') || null, null, price, active]);
      }
      console.log(`  OK: ${name} @ $${price}`);
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
    // invoices.csv: "Client Name", "Invoice Invoice Number", "Invoice Status" etc.
    const customerName = pick(r, 'client_name', 'customer_name', 'customer', 'client', 'bill_to');
    const customerEmail = pick(r, 'customer_email', 'client_email');
    const customer = findCustomer(customerName, customerEmail);

    const rawNum = pick(r, 'invoice_invoice_number', 'invoice_number', 'invoice_no', 'inv_number', 'number');
    const invNum = normalizeInvNum(rawNum);
    if (!invNum) { console.warn('  SKIP (no invoice number):', JSON.stringify(r)); skip++; continue; }

    const statusRaw = (pick(r, 'invoice_status', 'status') || 'draft').toLowerCase();
    const validStatuses = ['draft', 'sent', 'paid', 'cancelled'];
    const status = validStatuses.includes(statusRaw) ? statusRaw : 'draft';

    // Tax rate: "Invoice Tax Rate 1" = 7.00 means 7% → store as 0.07
    const taxRateRaw = toFloat(pick(r, 'invoice_tax_rate_1', 'tax_rate', 'tax', 'tax_percent', 'vat', 'gst'));
    let taxRate = taxRateRaw ?? 0.07;
    if (taxRate > 1) taxRate = taxRate / 100;

    // Tax exempt when rate is 0
    const taxExempt = taxRate === 0;
    // If exempt, keep the default 7% rate so it shows correctly when toggled
    if (taxExempt) taxRate = 0.07;

    const shipping = toFloat(pick(r, 'shipping', 'shipping_cost', 'freight', 'delivery')) ?? 0;
    const dueDate = toDate(pick(r, 'invoice_due_date', 'due_date', 'due', 'payment_due', 'due_by'));
    const invoiceDate = toDate(pick(r, 'invoice_date', 'date', 'created_date', 'invoice_created'));
    const notes = pick(r, 'notes', 'comments', 'memo') || null;

    try {
      const { rows: [inv] } = await pool.query(`
        INSERT INTO sales_invoices
          (invoice_number, customer_id, status, tax_rate, tax_exempt,
           shipping_cost, notes, due_date, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
          COALESCE($9::date, CURRENT_TIMESTAMP),
          COALESCE($9::date, CURRENT_TIMESTAMP))
        ON CONFLICT (invoice_number) DO NOTHING
        RETURNING id, invoice_number
      `, [invNum, customer?.id || null, status, taxRate, taxExempt, shipping, notes, dueDate,
          invoiceDate]);

      if (!inv) {
        console.warn(`  SKIP (duplicate): ${invNum}`);
        skip++; continue;
      }

      console.log(`  OK: ${invNum}${customer ? ` → ${customerName}` : ' (no customer match)'} [${status}]`);
      ok++;
    } catch (e) {
      console.error('  ERR:', e.message, '→', JSON.stringify(r));
      err++;
    }
  }

  // Advance the sequence past the highest imported invoice number
  await pool.query(`
    SELECT setval('sales_invoice_number_seq',
      GREATEST(
        (SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) FROM sales_invoices),
        nextval('sales_invoice_number_seq') - 1
      )
    )
  `);
  console.log(`  Done: ${ok} inserted, ${skip} skipped, ${err} errors`);
}

async function importLineItems(records) {
  console.log(`\nImporting ${records.length} line items…`);
  let ok = 0, skip = 0, err = 0;

  // Cache invoice numbers
  const { rows: invoices } = await pool.query('SELECT id, invoice_number FROM sales_invoices');
  const invMap = Object.fromEntries(invoices.map(i => [i.invoice_number.toUpperCase(), i.id]));

  for (const r of records) {
    const rawNum = pick(r, 'invoice_invoice_number', 'invoice_number', 'invoice_no', 'inv_number', 'number');
    const invNum = normalizeInvNum(rawNum);
    const invoiceId = invNum ? invMap[invNum] : null;
    if (!invoiceId) {
      console.warn(`  SKIP (invoice not found: ${rawNum} → ${invNum})`);
      skip++; continue;
    }

    // invoice_items.csv: "Item Product", "Item Quantity", "Item Cost", "Item Notes"
    const itemName = pick(r, 'item_product', 'product_name', 'item_name', 'name', 'description', 'item', 'product');
    if (!itemName) { console.warn('  SKIP (no product name):', JSON.stringify(r)); skip++; continue; }

    const price = toFloat(pick(r, 'item_cost', 'unit_price', 'price', 'rate', 'cost', 'amount'));
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
        pick(r, 'item_notes', 'details', 'description', 'notes') || null,
        toFloat(pick(r, 'item_quantity', 'quantity', 'qty', 'units')) ?? 1,
        price,
      ]);
      console.log(`  OK: ${invNum} — ${itemName}`);
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

/**
 * Generates and assigns SKUs for all products that currently have none.
 * Uses the same algorithm as the app: first letter of each word, uppercased,
 * with an incrementing -001 suffix (e.g. "3D Printed Phone Stand" → DPPS-001).
 *
 * Usage: node generate-skus.js [--dry-run]
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const envPaths = [
  resolve(__dirname, '.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../.env.example'),
];
for (const p of envPaths) {
  if (existsSync(p)) { dotenv.config({ path: p }); break; }
}

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
      }
);

function buildPrefix(name) {
  const words = name.split(/[\s\-_]+/).filter(w => /[a-zA-Z]/.test(w));
  return words.map(w => w.replace(/[^a-zA-Z]/g, '')[0] || '').join('').toUpperCase() || 'SKU';
}

async function suggestSku(name, excludeId, client) {
  const prefix = buildPrefix(name);
  const pattern = `${prefix}-%`;
  const excludeClause = excludeId ? `AND id != ${excludeId}` : '';
  const result = await client.query(
    `SELECT sku FROM products WHERE sku LIKE $1 ${excludeClause} ORDER BY sku DESC LIMIT 1`,
    [pattern]
  );
  if (!result.rows[0]?.sku) return `${prefix}-001`;
  const lastNum = parseInt(result.rows[0].sku.split('-').pop() || '0', 10);
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

const client = await pool.connect();
try {
  const { rows } = await client.query(
    `SELECT id, name FROM products WHERE sku IS NULL OR sku = '' ORDER BY id`
  );

  if (rows.length === 0) {
    console.log('All products already have SKUs.');
    process.exit(0);
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Generating SKUs for ${rows.length} products…\n`);

  for (const product of rows) {
    const sku = await suggestSku(product.name, product.id, client);
    console.log(`  ${product.name.padEnd(45)} → ${sku}`);
    if (!dryRun) {
      await client.query('UPDATE products SET sku = $1 WHERE id = $2', [sku, product.id]);
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] No changes written.' : `Done — ${rows.length} SKUs assigned.`}`);
} finally {
  client.release();
  await pool.end();
}

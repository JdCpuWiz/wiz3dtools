-- Migration 040 — Consolidate product details (BP #19 Phase 1 / Change #158).
--
-- Wiz picked Option A: collapse the duplicated product fields so there
-- is ONE place to edit each piece of information.
--
-- Before:                                      After:
--   products.name                              products.name
--   products.store_title       (dropped)
--   products.description                       products.description
--   products.store_description (dropped)
--   products.unit_price        (dropped)
--   products.wholesale_price                   products.wholesale_price
--   products.retail_price                      products.retail_price
--
--   customers (no wholesale flag)              customers.is_wholesale BOOLEAN
--
-- Migration safety:
-- 1) wiz3d-prints already uses `storeTitle ?? name` and
--    `storeDescription ?? defaultText` fallbacks at 6+ call sites.
--    Once the API stops returning the dropped fields, those fallbacks
--    return `undefined ?? name` → `name`. No wiz3d-prints deploy needed
--    in Phase 1; Phase 2 cleans up the now-dead fallback patterns.
-- 2) wiz3d-prints never reads `products.unit_price` — it always picks
--    wholesale_price (wholesale catalog) or retail_price (retail shop +
--    payment provider validation). Dropping unit_price is invisible
--    cross-system.
-- 3) `invoice_line_items.unit_price` is a SEPARATE column that stores
--    the snapshot price at sale time. Untouched. Historical invoice
--    math is preserved exactly.

BEGIN;

-- ── Backfill product names from storeTitle when name is empty ───────────────
-- Where both are set with different values, KEEP `name` — the canonical
-- invoice name is authoritative (per BP #19 Phase 1 design).
UPDATE products
   SET name = store_title
 WHERE store_title IS NOT NULL
   AND store_title <> ''
   AND (name IS NULL OR name = '');

-- Backfill descriptions same way.
UPDATE products
   SET description = store_description
 WHERE store_description IS NOT NULL
   AND store_description <> ''
   AND (description IS NULL OR description = '');

-- Backfill wholesale_price from unit_price when wholesale is unset or
-- zero. Historically `unit_price` was the wholesale invoice rate before
-- the dedicated wholesale/retail split was added in migration 030.
UPDATE products
   SET wholesale_price = unit_price
 WHERE (wholesale_price IS NULL OR wholesale_price = 0)
   AND unit_price IS NOT NULL
   AND unit_price > 0;

-- ── Drop the now-duplicated columns from products ──────────────────────────
ALTER TABLE products
  DROP COLUMN IF EXISTS store_title,
  DROP COLUMN IF EXISTS store_description,
  DROP COLUMN IF EXISTS unit_price;

-- ── Add the wholesale-flag mirror on customers ─────────────────────────────
-- Lives on the canonical customer record so wiz3dtools' InvoiceForm can
-- auto-pick wholesale-vs-retail line-item defaults without calling out
-- to wiz3d-prints. wiz3d-prints' role-change hook writes this column
-- when a user is promoted/demoted between wholesaler ↔ customer.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

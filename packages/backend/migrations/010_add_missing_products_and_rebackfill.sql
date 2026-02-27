-- Add products that appeared in imported line items but were missing from the catalog.
-- Prices marked with unit_price = 0 should be corrected manually in the UI.
INSERT INTO products (name, unit_price, is_active, created_at, updated_at)
VALUES
  ('Custom 3D Printed Phone Stand',        0.00,  true,  NOW(), NOW()),
  ('3D Printed Phone Stand - 4 color $17.50', 17.50, true,  NOW(), NOW()),
  ('Credit on account',                    0.00,  false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Re-backfill: match remaining unlinked line items by product_name only (case-insensitive).
-- Price may differ (historical snapshots); product_id is for analytics only.
-- Picks the lowest product id when multiple products share the same name.
UPDATE invoice_line_items ili
SET product_id = (
  SELECT p.id
  FROM products p
  WHERE LOWER(p.name) = LOWER(ili.product_name)
  ORDER BY p.id ASC
  LIMIT 1
)
WHERE ili.product_id IS NULL
  AND EXISTS (
    SELECT 1 FROM products p
    WHERE LOWER(p.name) = LOWER(ili.product_name)
  );

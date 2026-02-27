-- Backfill product_id on invoice_line_items for historical/imported rows.
-- Matches on product_name + unit_price; picks the lowest product id when
-- multiple products share the same name and price.
UPDATE invoice_line_items ili
SET product_id = (
  SELECT p.id
  FROM products p
  WHERE p.name = ili.product_name
    AND p.unit_price = ili.unit_price
  ORDER BY p.id ASC
  LIMIT 1
)
WHERE ili.product_id IS NULL
  AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = ili.product_name
      AND p.unit_price = ili.unit_price
  );

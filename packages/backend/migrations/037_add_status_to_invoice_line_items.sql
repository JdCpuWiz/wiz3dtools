-- Change #149 — per-line-item completion tracking on sales invoices.
-- Adds a status column to invoice_line_items. Values:
--   'pending'     — default for new and existing rows; not yet built
--   'completed'   — fulfilled, ready to ship
--   'backordered' — cannot fulfill in this shipment; flagged on the invoice
-- Ship endpoint gates on every line being completed or backordered.

ALTER TABLE invoice_line_items
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'backordered'));

-- Existing shipped invoices: backfill their line items to 'completed' so
-- the new ship-gate doesn't retroactively flag historical rows.
UPDATE invoice_line_items li
SET status = 'completed'
FROM sales_invoices si
WHERE li.invoice_id = si.id
  AND si.shipped_at IS NOT NULL;

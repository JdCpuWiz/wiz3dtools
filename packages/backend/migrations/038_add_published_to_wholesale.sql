-- BuildPlan #12 Phase 9 cleanup — split webstore vs wholesale visibility.
--
-- Until now there was a single `published_to_store` flag controlling whether
-- a product appeared on BOTH the consumer webstore (/shop) and the wholesale
-- portal (/wholesale/products). Wiz wants independent control so a product
-- can be wholesale-only, webstore-only, or both.
--
-- Add a sibling boolean. Backfill from the existing flag so day-1 behavior
-- is unchanged — every currently-store-published product is also wholesale-
-- published. Admin can then untick whichever channel doesn't apply.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS published_to_wholesale BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
  SET published_to_wholesale = published_to_store
  WHERE published_to_wholesale = FALSE
    AND published_to_store = TRUE;

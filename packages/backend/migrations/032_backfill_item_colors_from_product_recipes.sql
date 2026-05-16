-- Backfill line_item_colors and queue_item_colors for invoices that
-- predate the v1.19.0 color-variation rollout. Each invoice_line_item
-- linked to a product gets one color row per slot in that product's
-- CURRENT product_colors recipe. Queue items inherit from their source
-- line item, mirroring QueueItemColorModel.copyFromLineItem.
--
-- Tradeoff: historical orders are colored with the product's recipe AS
-- IT IS TODAY, not as it was when the order was placed. The plan
-- explicitly accepts this — the alternative is leaving thousands of
-- rows un-colored forever. See /home/shad/.claude/plans/witty-spinning-curry.md.
--
-- Idempotent: NOT EXISTS guards make re-runs a no-op once each line
-- item / queue item has at least one color row.

-- Phase 1: backfill line_item_colors from each product's recipe defaults.
INSERT INTO line_item_colors (line_item_id, color_id, is_primary, sort_order, weight_grams)
SELECT
  ili.id,
  pc.color_id,
  (pc.sort_order = 0),    -- first slot = primary
  pc.sort_order,
  pc.weight_grams
FROM invoice_line_items ili
JOIN product_colors pc ON pc.product_id = ili.product_id
WHERE ili.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM line_item_colors lic
    WHERE lic.line_item_id = ili.id
  );

-- Phase 2: backfill queue_item_colors by copying from the line item that
-- spawned each queue item. Use DISTINCT ON to handle the edge case where
-- more than one line_item points at the same queue_item — keep the
-- lowest line_item id, so the source is deterministic.
INSERT INTO queue_item_colors (queue_item_id, color_id, is_primary, sort_order, weight_grams)
SELECT
  source.queue_item_id,
  lic.color_id,
  lic.is_primary,
  lic.sort_order,
  lic.weight_grams
FROM (
  SELECT DISTINCT ON (queue_item_id) id, queue_item_id
  FROM invoice_line_items
  WHERE queue_item_id IS NOT NULL
  ORDER BY queue_item_id, id ASC
) source
JOIN line_item_colors lic ON lic.line_item_id = source.id
WHERE NOT EXISTS (
  SELECT 1 FROM queue_item_colors qic
  WHERE qic.queue_item_id = source.queue_item_id
);

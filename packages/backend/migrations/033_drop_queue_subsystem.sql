-- Migration 033 — Drop queue + filament_jobs + printers subsystem.
--
-- BuildPlan #6 Phase 3 (2026-06-04). BamBuddy owns the printer queue,
-- printer registry, and filament tracking now. wiz3dtools keeps the
-- color catalog (`colors` + `manufacturers`) for the wiz3d-prints store
-- color picker and the Sales Invoice line-item ColorPicker — see
-- BuildPlan #6 Phase 4 for the BamBuddy → colors sync strategy.
--
-- Pre-condition: a pg_dump of the four tables MUST exist on the
-- wiz3dtools LXC before this migration runs. The deploy-wiz3dtools
-- playbook handles the dump automatically; if running migrations by
-- hand, do this first:
--   pg_dump -h $PGHOST -U $PGUSER -d $PGDB \
--     -t queue_items -t queue_item_colors -t filament_jobs -t printers \
--     > /home/shad/wiz3dtools/archive/pre-phase3-$(date +%F).sql
--
-- FK chain (drop in this order to avoid orphaning):
--   invoice_line_items.queue_item_id  → queue_items   (ON DELETE SET NULL)
--   queue_item_colors.queue_item_id   → queue_items   (ON DELETE CASCADE)
--   filament_jobs.queue_item_id       → queue_items   (ON DELETE SET NULL)
--   filament_jobs.printer_id          → printers      (ON DELETE SET NULL)
--
-- `invoice_line_items.sku` is INTENTIONALLY KEPT — it serves the invoice
-- item display and matches the product's sku for invoice → product
-- traceability. Only queue_item_id is removed.

BEGIN;

-- 1. Drop the FK column on invoice_line_items (the only inbound FK from
--    a surviving table to queue_items).
ALTER TABLE invoice_line_items
  DROP COLUMN IF EXISTS queue_item_id;

-- 2. Drop the queue-side colors table (CASCADE handles trigger / FK
--    cleanup if any was added in later migrations).
DROP TABLE IF EXISTS queue_item_colors CASCADE;

-- 3. Drop filament_jobs (had FKs to both queue_items and printers; goes
--    before either of them).
DROP TABLE IF EXISTS filament_jobs CASCADE;

-- 4. Drop queue_items.
DROP TABLE IF EXISTS queue_items CASCADE;

-- 5. Drop printers (the in-house printer registry — printers live in
--    BamBuddy now, accessed by serial number from wiz3dtools when
--    needed, no local mirror).
DROP TABLE IF EXISTS printers CASCADE;

COMMIT;

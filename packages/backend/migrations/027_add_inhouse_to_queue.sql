-- Migration 027: In-house print tracking
-- Adds is_inhouse flag to queue items so prints can be tracked without an invoice.
-- Adds queue_item_id FK to filament_jobs so Bambu monitor can link deductions back.

ALTER TABLE queue_items
  ADD COLUMN IF NOT EXISTS is_inhouse BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE filament_jobs
  ADD COLUMN IF NOT EXISTS queue_item_id INTEGER REFERENCES queue_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_filament_jobs_queue_item ON filament_jobs(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_inhouse ON queue_items(is_inhouse) WHERE is_inhouse = true;

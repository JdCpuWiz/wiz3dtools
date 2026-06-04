-- Migration 034 — Add BamBuddy linking + material disambiguator on colors.
--
-- BuildPlan #6 Phase 4 (2026-06-04). With the queue/filament_jobs gone,
-- the `colors` table is no longer auto-fed by FINISH events. Phase 4
-- wires a "Sync from BamBuddy" pull that pulls BamBuddy's authoritative
-- filament catalog (633 rows across PLA/ABS/PETG/etc.) and overwrites
-- inventory_grams from BamBuddy's spool ledger.
--
-- bambuddy_id is the precise link key for incremental sync. material
-- is BamBuddy's color disambiguator (Black PLA and Black ABS share
-- a hex but differ on material). Both nullable — manually-created
-- colors (e.g. a one-off custom hex) can stay unlinked. Existing rows
-- backfilled to material='PLA' since that's the only material wiz3dtools
-- historically tracked.
--
-- The partial unique index on bambuddy_id allows multiple unlinked rows
-- (NULL) while preventing duplicate links to the same BamBuddy color.

ALTER TABLE colors
  ADD COLUMN IF NOT EXISTS bambuddy_id INTEGER,
  ADD COLUMN IF NOT EXISTS material VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS colors_bambuddy_id_unique
  ON colors(bambuddy_id)
  WHERE bambuddy_id IS NOT NULL;

UPDATE colors SET material = 'PLA' WHERE material IS NULL;

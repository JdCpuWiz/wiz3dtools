-- Migration 039 — Multi-color filament support on colors.
--
-- Bug #66 follow-up. Solid-color and dual/multi-color filaments share
-- the same primary hex (a Bambu Dual-Color PLA Black/Pink has hex
-- #000000 just like solid Black PLA), so the v1.13.0 dedupe groups
-- false-matched them. Fix: stamp multi-color rows + carry their
-- secondary hex(es), and include those in the dedupe identity key.
--
-- additional_hexes is an ordered TEXT[] of "#RRGGBB" values; empty for
-- solid-color rows. Cap usage at 3 secondaries in the API layer
-- (4-color filaments do exist but are vanishingly rare).
--
-- New columns are nullable-with-default so the migration is safe to
-- run against the live shared cluster without touching existing rows.

ALTER TABLE colors
  ADD COLUMN IF NOT EXISTS is_multi_color BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS additional_hexes TEXT[] NOT NULL DEFAULT '{}';

-- Migration 041 — Per-product allowed-materials allowlist.
--
-- Wiz reported that the storefront PDP's color picker let customers
-- pick ANY filament from the active catalog, which means a PLA-only
-- product could be ordered in PETG-HF (different temps, would fail to
-- print on the wrong material). Add a per-product allowlist of
-- material family tokens ("pla", "abs", "petg", "tpu", etc.) and the
-- picker + order validation will respect it.
--
-- Empty array = no constraint, all materials allowed. This keeps
-- existing products working unchanged until admin starts marking them.
-- TEXT[] mirrors the additional_hexes column shape on colors —
-- consistent + no new table for a small string list.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allowed_materials TEXT[] NOT NULL DEFAULT '{}';

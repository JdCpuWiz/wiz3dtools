-- Migration 042 — Backfill empty allowed_materials to ['pla'] (Change #160 follow-up).
--
-- Wiz request via chat (2026-06-14): all existing products should
-- default to PLA-only so the storefront picker stops offering ABS /
-- PETG / TPU on items that are physically printed in PLA. Products
-- admin has ALREADY tagged with specific materials are left alone —
-- their allowlist is the intentional choice.
--
-- Idempotent: re-runs match zero rows once everyone's tagged. Uses
-- cardinality() = 0 (the canonical Postgres "empty array" check)
-- rather than `= '{}'::TEXT[]` for clarity. Also catches the NULL
-- case defensively even though the column is NOT NULL DEFAULT '{}'.

UPDATE products
   SET allowed_materials = ARRAY['pla']
 WHERE allowed_materials IS NULL
    OR cardinality(allowed_materials) = 0;

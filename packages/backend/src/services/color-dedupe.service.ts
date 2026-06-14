import { pool } from '../config/database.js';

// Bug #66 + Change #159 — admin colors dedupe.
//
// SCOPE OF A GROUP (what shows up together in the modal):
//   (UPPER(hex), material_family) — aligned with what the merge guard
//   actually accepts. Variants within a family (PLA / PLA Basic /
//   PLA-CF / PLA Matte) cluster together; cross-family rows at the
//   same hex (PLA green vs PETG-HF green) DON'T appear as duplicates
//   because they're different filaments. Within each group, per-row
//   badges still surface manufacturer / multi-color flag /
//   additional-hex diffs so the admin can see why rows differ on
//   dimensions the merge guard doesn't strictly check.
//
// SCOPE OF A MERGE (what's actually safe to fold into a keeper):
//   Hex must match (the panel-grouping invariant). Material FAMILY
//   must match (or be NULL on one side) — same hex + different family
//   means physically distinct filaments (PLA vs ABS share #FF6A13 but
//   one melts at 220°C and the other at 260°C). The bambuddy_id of
//   any row being deleted must be NULL (otherwise the next sync would
//   re-insert it). EVERYTHING ELSE — material VARIANT within a
//   family / manufacturer_id / is_multi_color / additional_hexes — is
//   an admin assertion: by picking a keeper, the admin is declaring
//   "these rows ARE the same filament regardless of how the labels
//   diverged." The keeper's values win for every dimension; the dupe
//   rows' values are discarded along with the rows.
//
//   Change #159 evolution:
//   - Original strict-identity refusal blocked legitimate cases like
//     "PLA" vs "PLA Basic" (same Bambu filament, different label era).
//   - First loosening (dropped ALL material checks) over-corrected and
//     let PLA merge into ABS — actually distinct filaments.
//   - Current: family-level check via materialFamily() helper below.
//     Same family token → merge; different family → refuse.
//
//   Risk is bounded: line_item_colors snapshots its own unit_price
//   per line so historical invoice math is invariant under color
//   reference shifts.
//
// Color rows in the live DB are referenced by exactly two FK locations
// after BuildPlan #6 Phase 3 dropped the queue subsystem:
//   1. line_item_colors.color_id  — NOT NULL, no unique constraint
//   2. product_colors.color_id    — NOT NULL, UNIQUE(product_id, color_id),
//                                    ON DELETE CASCADE
// queue_item_colors + filament_jobs are gone (verified migration 033).
//
// Merge strategy (per dupe id → keeper id, all in one tx):
//   - line_item_colors: plain UPDATE color_id = keeper (no conflicts possible)
//   - product_colors: UPDATE where possible; on UNIQUE collision the keeper
//     already has a row for the same product, so we SUM weight_grams onto
//     the keeper's row and DELETE the dupe's row.
//   - DELETE FROM colors WHERE id = dupe.
// Returns counts so the UI can confirm what moved.

export interface DuplicateGroup {
  hex: string;
  // Material family token (e.g. "pla", "abs", "petg") shared by every
  // row in this group. Empty string when all rows in the group have
  // material=NULL. Drives the (hex, family) grouping key.
  materialFamily: string;
  // First row's material as a display hint for the group header
  // (e.g. "PLA Basic"). Per-row labels still vary within the group.
  sampleMaterial: string | null;
  manufacturerId: number | null;
  manufacturerName: string | null;
  isMultiColor: boolean;
  additionalHexes: string[];
  count: number;
  rows: DuplicateRow[];
}

export interface DuplicateRow {
  id: number;
  name: string;
  hex: string;
  material: string | null;
  manufacturerId: number | null;
  manufacturerName: string | null;
  isMultiColor: boolean;
  additionalHexes: string[];
  bambuddyId: number | null;
  active: boolean;
  inventoryGrams: number;
  lineItemRefs: number;
  productRefs: number;
}

// Normalises additional_hexes to a stable comparable form: uppercased
// + sorted (order doesn't matter for filament identity).
function normaliseHexes(arr: string[] | null): string[] {
  if (!arr) return [];
  return [...arr].map((h) => h.toUpperCase()).sort();
}

// Material FAMILY (Change #159 follow-up #2). Wiz reported merging
// PLA into ABS via the loosened guard — same hex (#FF6A13) but
// fundamentally different filaments (different temps, different
// physical behavior). The fix: classify each material string into
// its base family by taking the leading alphanumeric token. So:
//   "PLA"        → "pla"
//   "PLA Basic"  → "pla"
//   "PLA Matte"  → "pla"
//   "PLA-CF"     → "pla"
//   "PLA+"       → "pla"
//   "ABS"        → "abs"
//   "ABS-GF"     → "abs"
//   "PETG-CF"    → "petg"
//   "TPU 95A"    → "tpu"
// Variants within a family merge fine (admin asserts they're the same
// Bambu filament with different label eras). Cross-family merges are
// refused with a clear message.
export function materialFamily(m: string | null): string | null {
  if (!m) return null;
  const match = m.trim().toLowerCase().match(/^[a-z0-9]+/);
  return match ? match[0] : null;
}

export async function findDuplicates(): Promise<DuplicateGroup[]> {
  // Visibility-focused query: pull every row whose UPPER(hex) is shared
  // by 2+ rows. Identity dimensions (material / manufacturer / multi-
  // color / additional_hexes) come back as per-row badges so the UI can
  // expose WHY rows that look duplicated don't auto-merge. Merge safety
  // is enforced in mergeColors() below, not at the grouping level.
  const rows = await pool.query<{
    id: number;
    name: string;
    hex: string;
    material: string | null;
    manufacturer_id: number | null;
    manufacturer_name: string | null;
    is_multi_color: boolean;
    additional_hexes: string[] | null;
    bambuddy_id: number | null;
    active: boolean;
    inventory_grams: string;
    family: string;
    line_item_refs: string;
    product_refs: string;
  }>(`
    WITH rows_with_family AS (
      SELECT
        c.*,
        UPPER(c.hex) AS hex_upper,
        -- Material family token, matching the JS helper in this file
        -- and the frontend. NULL material → empty string.
        LOWER(COALESCE((regexp_match(c.material, '^[A-Za-z0-9]+'))[1], '')) AS family
      FROM colors c
    ),
    dup_keys AS (
      SELECT hex_upper, family
      FROM rows_with_family
      GROUP BY hex_upper, family
      HAVING COUNT(*) > 1
    ),
    line_refs AS (
      SELECT color_id, COUNT(*)::int AS n FROM line_item_colors GROUP BY color_id
    ),
    product_refs AS (
      SELECT color_id, COUNT(*)::int AS n FROM product_colors GROUP BY color_id
    )
    SELECT
      r.id,
      r.name,
      r.hex,
      r.material,
      r.manufacturer_id,
      m.name AS manufacturer_name,
      r.is_multi_color,
      r.additional_hexes,
      r.bambuddy_id,
      r.active,
      r.inventory_grams,
      r.family,
      COALESCE(lr.n, 0) AS line_item_refs,
      COALESCE(pr.n, 0) AS product_refs
    FROM rows_with_family r
    INNER JOIN dup_keys dk
      ON r.hex_upper = dk.hex_upper AND r.family = dk.family
    LEFT JOIN manufacturers m  ON m.id = r.manufacturer_id
    LEFT JOIN line_refs lr     ON lr.color_id = r.id
    LEFT JOIN product_refs pr  ON pr.color_id = r.id
    ORDER BY UPPER(r.hex), r.family, r.material NULLS FIRST, r.manufacturer_id NULLS FIRST, r.id ASC
  `);

  const byKey = new Map<string, DuplicateGroup>();
  for (const r of rows.rows) {
    const normalisedHexes = normaliseHexes(r.additional_hexes);
    // Group key: (UPPER(hex), material_family). PLA green and PETG-HF
    // green at the same hex go into separate groups — they're
    // physically distinct filaments, not duplicates.
    const family = r.family;
    const key = `${r.hex.toUpperCase()}|${family}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        hex: r.hex.toUpperCase(),
        materialFamily: family,
        sampleMaterial: r.material,
        manufacturerId: r.manufacturer_id,
        manufacturerName: r.manufacturer_name,
        isMultiColor: r.is_multi_color,
        additionalHexes: normalisedHexes,
        count: 0,
        rows: [],
      };
      byKey.set(key, group);
    }
    group.rows.push({
      id: r.id,
      name: r.name,
      hex: r.hex,
      material: r.material,
      manufacturerId: r.manufacturer_id,
      manufacturerName: r.manufacturer_name,
      isMultiColor: r.is_multi_color,
      additionalHexes: r.additional_hexes ?? [],
      bambuddyId: r.bambuddy_id,
      active: r.active,
      inventoryGrams: parseFloat(r.inventory_grams),
      lineItemRefs: parseInt(String(r.line_item_refs), 10),
      productRefs: parseInt(String(r.product_refs), 10),
    });
    group.count = group.rows.length;
  }

  // Drop singleton groups — they're not duplicates.
  return Array.from(byKey.values()).filter((g) => g.count > 1);
}

export interface MergeResult {
  keepId: number;
  merged: number;
  lineItemColorsRepointed: number;
  productColorsRepointed: number;
  productColorsMerged: number;
  colorsDeleted: number;
}

export async function mergeColors(
  keepId: number,
  mergeIds: number[],
): Promise<MergeResult> {
  if (mergeIds.includes(keepId)) {
    throw Object.assign(
      new Error('keepId must not appear in mergeIds'),
      { statusCode: 400 },
    );
  }
  if (mergeIds.length === 0) {
    throw Object.assign(new Error('mergeIds must be non-empty'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sanity 1 — hex must match. Hex is the dedupe panel's grouping
    // dimension; allowing cross-hex merges would mean the admin clicked
    // through a wholly unrelated row. That's almost certainly a UI bug.
    //
    // Sanity 2 — material FAMILY must match (or be NULL on one side).
    // Variants within a family merge fine ("PLA" vs "PLA Basic" vs
    // "PLA-CF" all share the "pla" family token). Cross-family merges
    // (PLA vs ABS, PLA vs PETG) are refused — those are different
    // filaments that happen to share a hex.
    //
    // Sanity 3 — refuse to delete any row whose bambuddy_id is set
    // (the BamBuddy sync would re-insert a fresh dupe on next run).
    // See comment at the top of the file for the sync's match logic.
    //
    // EVERYTHING ELSE goes through — manufacturer_id / is_multi_color /
    // additional_hexes, and material VARIANTS within the same family.
    // The keeper's values win and the dupe rows' values get discarded
    // along with the rows. Frontend warns about identity diffs in a
    // confirm dialog so this is an explicit admin assertion, not a
    // silent coalesce. line_item_colors snapshots its own unit_price
    // per line so historical invoice math is invariant under color
    // reference shifts.
    const idsRes = await client.query<{
      id: number;
      hex: string;
      material: string | null;
      bambuddy_id: number | null;
    }>(
      `SELECT id, UPPER(hex) AS hex, material, bambuddy_id
         FROM colors
        WHERE id = ANY($1::int[])
        FOR UPDATE`,
      [[keepId, ...mergeIds]],
    );
    const byId = new Map(idsRes.rows.map((r) => [r.id, r]));
    const keeper = byId.get(keepId);
    if (!keeper) {
      throw Object.assign(new Error(`Keeper color ${keepId} not found`), { statusCode: 404 });
    }
    const keeperFamily = materialFamily(keeper.material);
    for (const mid of mergeIds) {
      const row = byId.get(mid);
      if (!row) {
        throw Object.assign(new Error(`Color ${mid} not found`), { statusCode: 404 });
      }
      if (row.hex !== keeper.hex) {
        throw Object.assign(
          new Error(`Color ${mid} hex ${row.hex} doesn't match keeper hex ${keeper.hex}. Refusing merge across different hexes.`),
          { statusCode: 400 },
        );
      }
      const rowFamily = materialFamily(row.material);
      // Both sides have known families AND they disagree → refuse.
      // If either side is NULL we treat it as "unknown — admin assertion
      // wins" since the row needs a material set anyway.
      if (rowFamily && keeperFamily && rowFamily !== keeperFamily) {
        throw Object.assign(
          new Error(
            `Color ${mid} material family "${row.material}" (${rowFamily}) is a different filament from keeper's "${keeper.material}" (${keeperFamily}). PLA and ABS (etc.) are physically distinct filaments — refusing merge across families.`,
          ),
          { statusCode: 400 },
        );
      }
      if (row.bambuddy_id !== null) {
        throw Object.assign(
          new Error(
            `Color ${mid} is linked to BamBuddy (bambuddy_id=${row.bambuddy_id}). Deleting it would cause the next sync to re-insert a fresh duplicate. Pick the linked row as keeper instead.`,
          ),
          { statusCode: 409 },
        );
      }
    }

    // line_item_colors: bulk repoint. No unique constraint, safe.
    const lineRes = await client.query(
      `UPDATE line_item_colors SET color_id = $1 WHERE color_id = ANY($2::int[])`,
      [keepId, mergeIds],
    );
    const lineItemColorsRepointed = lineRes.rowCount ?? 0;

    // product_colors: UNIQUE(product_id, color_id). For each dupe row, try
    // UPDATE → keeper; on conflict, sum weight_grams onto the keeper's row
    // and delete the dupe's row. Do it row-by-row to handle each conflict
    // deterministically.
    let productColorsRepointed = 0;
    let productColorsMerged = 0;
    const productRows = await client.query<{
      id: number;
      product_id: number;
      color_id: number;
      weight_grams: string;
      sort_order: number;
    }>(
      `SELECT id, product_id, color_id, weight_grams, sort_order
         FROM product_colors
        WHERE color_id = ANY($1::int[])
        ORDER BY id`,
      [mergeIds],
    );
    for (const pc of productRows.rows) {
      const conflict = await client.query<{ id: number; weight_grams: string }>(
        `SELECT id, weight_grams FROM product_colors WHERE product_id = $1 AND color_id = $2`,
        [pc.product_id, keepId],
      );
      if (conflict.rows.length === 0) {
        // No keeper row for this product → simple repoint.
        await client.query(
          `UPDATE product_colors SET color_id = $1 WHERE id = $2`,
          [keepId, pc.id],
        );
        productColorsRepointed++;
      } else {
        // Keeper already covers this product → sum weights onto keeper,
        // drop the dupe row. Both rows share a recipe slot in practice
        // (otherwise the product is mid-rebuild and dupes wouldn't exist).
        const summed =
          parseFloat(conflict.rows[0].weight_grams) + parseFloat(pc.weight_grams);
        await client.query(
          `UPDATE product_colors SET weight_grams = $1 WHERE id = $2`,
          [summed, conflict.rows[0].id],
        );
        await client.query(`DELETE FROM product_colors WHERE id = $1`, [pc.id]);
        productColorsMerged++;
      }
    }

    // Drop the dupe color rows. inventory_grams from dupes is NOT summed
    // onto the keeper — inventory is rebuilt from BamBuddy on the next
    // sync anyway, and keeping it as-is avoids over-counting if dupes
    // were already double-tracked.
    const delRes = await client.query(
      `DELETE FROM colors WHERE id = ANY($1::int[])`,
      [mergeIds],
    );
    const colorsDeleted = delRes.rowCount ?? 0;

    await client.query('COMMIT');
    return {
      keepId,
      merged: mergeIds.length,
      lineItemColorsRepointed,
      productColorsRepointed,
      productColorsMerged,
      colorsDeleted,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

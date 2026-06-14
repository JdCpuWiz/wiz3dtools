import { pool } from '../config/database.js';

// Bug #66 — admin colors dedupe.
//
// Duplicates are identified by (UPPER(hex), material) — same physical
// filament identity. Name + manufacturer + bambuddy_id may differ across
// rows in a group; the admin picks which row to keep in the UI.
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
  material: string | null;
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
  bambuddyId: number | null;
  active: boolean;
  inventoryGrams: number;
  lineItemRefs: number;
  productRefs: number;
}

export async function findDuplicates(): Promise<DuplicateGroup[]> {
  // Single query that returns every color in a (UPPER(hex), material)
  // group with count > 1, plus per-row FK usage counts so the UI can
  // surface "keeping this id will preserve N invoice references."
  const rows = await pool.query<{
    id: number;
    name: string;
    hex: string;
    material: string | null;
    manufacturer_id: number | null;
    manufacturer_name: string | null;
    bambuddy_id: number | null;
    active: boolean;
    inventory_grams: string;
    line_item_refs: string;
    product_refs: string;
    group_key_hex: string;
  }>(`
    WITH groups AS (
      SELECT UPPER(hex) AS group_key_hex, material
      FROM colors
      GROUP BY UPPER(hex), material
      HAVING COUNT(*) > 1
    ),
    line_refs AS (
      SELECT color_id, COUNT(*)::int AS n FROM line_item_colors GROUP BY color_id
    ),
    product_refs AS (
      SELECT color_id, COUNT(*)::int AS n FROM product_colors GROUP BY color_id
    )
    SELECT
      c.id,
      c.name,
      c.hex,
      c.material,
      c.manufacturer_id,
      m.name AS manufacturer_name,
      c.bambuddy_id,
      c.active,
      c.inventory_grams,
      COALESCE(lr.n, 0) AS line_item_refs,
      COALESCE(pr.n, 0) AS product_refs,
      UPPER(c.hex) AS group_key_hex
    FROM colors c
    INNER JOIN groups g
      ON UPPER(c.hex) = g.group_key_hex
     AND c.material IS NOT DISTINCT FROM g.material
    LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
    LEFT JOIN line_refs lr   ON lr.color_id = c.id
    LEFT JOIN product_refs pr ON pr.color_id = c.id
    ORDER BY UPPER(c.hex), c.material NULLS FIRST, c.id ASC
  `);

  const byKey = new Map<string, DuplicateGroup>();
  for (const r of rows.rows) {
    const key = `${r.group_key_hex}|${r.material ?? '∅'}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        hex: r.group_key_hex,
        material: r.material,
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
      bambuddyId: r.bambuddy_id,
      active: r.active,
      inventoryGrams: parseFloat(r.inventory_grams),
      lineItemRefs: parseInt(String(r.line_item_refs), 10),
      productRefs: parseInt(String(r.product_refs), 10),
    });
    group.count = group.rows.length;
  }

  return Array.from(byKey.values());
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

    // Sanity 1 — keeper + dupes must exist AND share the same (UPPER(hex), material).
    // Refuse the merge otherwise — that protects against the admin picking
    // unrelated rows from the UI (would change invoice colors silently).
    //
    // Sanity 2 — refuse to delete any row whose bambuddy_id is set, because
    // the next nightly BamBuddy sync would just INSERT a fresh dupe.
    // (Sync's match logic: 1) bambuddy_id, 2) (UPPER(hex), material) ONLY
    // when local bambuddy_id IS NULL. If the keeper has its own
    // bambuddy_id ≠ the deleted dupe's, fallback clause 2 misses, and
    // INSERT path runs. So: keeper must own the bambuddy_id if any
    // dupe row has one. The UI defaults to the linked row as keeper;
    // this gate is the belt-and-suspenders backstop.
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
    for (const mid of mergeIds) {
      const row = byId.get(mid);
      if (!row) {
        throw Object.assign(new Error(`Color ${mid} not found`), { statusCode: 404 });
      }
      if (row.hex !== keeper.hex || (row.material ?? null) !== (keeper.material ?? null)) {
        throw Object.assign(
          new Error(
            `Color ${mid} has hex ${row.hex}/${row.material ?? 'NULL'} which doesn't match keeper ${keeper.hex}/${keeper.material ?? 'NULL'}. Refusing merge.`,
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

import { pool } from '../config/database.js';

// BuildPlan #6 Phase 4 (2026-06-04). Pulls BamBuddy's authoritative
// filament catalog into wiz3dtools' `colors` table and updates per-color
// inventory_grams from BamBuddy's spool ledger.
//
// Two endpoints:
//   GET /api/v1/inventory/colors  →  the full color catalog (~633 rows)
//   GET /api/v1/inventory/spools  →  every spool BamBuddy knows about
//
// Sync direction is one-way (BamBuddy → wiz3dtools). Wiz3dtools owns
// `active` (which colors show on the wiz3d-prints store) and
// `sort_order` — those are NEVER touched by the sync. The sync writes
// name, hex, material, manufacturer_id, bambuddy_id, and inventory_grams.
//
// New BamBuddy colors arrive with active=false so the wiz3d-prints
// customer picker doesn't suddenly grow 600+ options Wiz never curated.

const BAMBUDDY_URL = (process.env.BAMBUDDY_URL || 'http://192.168.7.147:8000').replace(/\/+$/, '');
const BAMBUDDY_API_KEY = process.env.BAMBUDDY_API_KEY || '';

interface BBColor {
  id: number;
  manufacturer: string;
  color_name: string;
  hex_color: string;        // "#RRGGBB"
  material: string;
  is_default: boolean;
}

interface BBSpool {
  id: number;
  brand: string;
  material: string;
  subtype: string | null;
  color_name: string;
  rgba: string;             // "RRGGBBAA"
  label_weight: number;     // grams of fresh filament on a new spool
  core_weight: number;      // grams of the empty spool core
  weight_used: number;      // grams consumed
  archived_at: string | null;
}

async function bbFetch<T>(path: string): Promise<T> {
  if (!BAMBUDDY_API_KEY) {
    throw new Error('BAMBUDDY_API_KEY is not configured — cannot sync');
  }
  const res = await fetch(`${BAMBUDDY_URL}${path}`, {
    headers: { 'X-API-Key': BAMBUDDY_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BamBuddy ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface CatalogSyncResult {
  added: number;
  updated: number;
  untouched: number;
  manufacturerUnmatched: number;
  total: number;
}

export interface InventorySyncResult {
  colorsUpdated: number;
  totalGrams: number;
  unmatchedSpools: number;
}

export interface FullSyncResult {
  catalog: CatalogSyncResult;
  inventory: InventorySyncResult;
  finishedAt: string;
}

/**
 * Pulls /api/v1/inventory/colors and upserts into the local `colors` table.
 * Matching strategy (in order):
 *   1) bambuddy_id (precise, set by previous syncs)
 *   2) (lower(hex), lower(material)) — first-time linking
 *   3) Otherwise, INSERT new row with active=false.
 *
 * Manufacturer linking: BamBuddy gives manufacturer as a string ("Bambu
 * Lab"). We do a case-insensitive name match into the local manufacturers
 * table. No auto-create — unmatched manufacturers leave the new color
 * with manufacturer_id=NULL and surface in the diff summary so Wiz can
 * fix them from /admin/manufacturers.
 */
export async function syncCatalog(): Promise<CatalogSyncResult> {
  const bbColors = await bbFetch<BBColor[]>('/api/v1/inventory/colors');

  // Manufacturer name → id map (case-insensitive)
  const mfgResult = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM manufacturers`,
  );
  const mfgByName = new Map<string, number>();
  for (const m of mfgResult.rows) {
    mfgByName.set(m.name.toLowerCase().trim(), m.id);
  }

  let added = 0;
  let updated = 0;
  let untouched = 0;
  let manufacturerUnmatched = 0;

  // Track next sort_order for NEW rows (append at end so existing order is preserved)
  const maxOrderResult = await pool.query<{ max: number | null }>(
    `SELECT MAX(sort_order) as max FROM colors`,
  );
  let nextSortOrder = (maxOrderResult.rows[0]?.max ?? 0) + 1;

  for (const bb of bbColors) {
    const hex = bb.hex_color.toUpperCase();
    const material = bb.material;
    const mfgId = mfgByName.get(bb.manufacturer.toLowerCase().trim()) ?? null;
    if (!mfgId) manufacturerUnmatched++;

    // Try precise match first, then (hex, material) fallback.
    const existing = await pool.query<{
      id: number;
      name: string;
      hex: string;
      material: string | null;
      manufacturer_id: number | null;
      bambuddy_id: number | null;
    }>(
      `SELECT id, name, hex, material, manufacturer_id, bambuddy_id
       FROM colors
       WHERE bambuddy_id = $1
          OR (bambuddy_id IS NULL AND UPPER(hex) = $2 AND material IS NOT DISTINCT FROM $3)
       LIMIT 1`,
      [bb.id, hex, material],
    );

    if (existing.rows.length === 0) {
      // New BamBuddy color — insert as inactive so it doesn't appear on the
      // wiz3d-prints store until Wiz explicitly activates it.
      await pool.query(
        `INSERT INTO colors
           (name, hex, material, manufacturer_id, bambuddy_id, active, sort_order)
         VALUES ($1, $2, $3, $4, $5, false, $6)`,
        [bb.color_name, hex, material, mfgId, bb.id, nextSortOrder++],
      );
      added++;
    } else {
      const row = existing.rows[0];
      // Update only the BamBuddy-sourced fields. NEVER touch active or
      // sort_order — those are wiz3dtools-owned curation state.
      const needsUpdate =
        row.name !== bb.color_name ||
        row.hex.toUpperCase() !== hex ||
        row.material !== material ||
        row.manufacturer_id !== mfgId ||
        row.bambuddy_id !== bb.id;

      if (needsUpdate) {
        await pool.query(
          `UPDATE colors
              SET name = $1,
                  hex = $2,
                  material = $3,
                  manufacturer_id = $4,
                  bambuddy_id = $5,
                  updated_at = NOW()
            WHERE id = $6`,
          [bb.color_name, hex, material, mfgId, bb.id, row.id],
        );
        updated++;
      } else {
        untouched++;
      }
    }
  }

  return {
    added,
    updated,
    untouched,
    manufacturerUnmatched,
    total: bbColors.length,
  };
}

/**
 * Pulls /api/v1/inventory/spools and refreshes per-color inventory_grams.
 *
 * Spool → color match: (hex from rgba[:6], material, manufacturer name).
 * For each color we sum (label_weight - weight_used) across non-archived
 * spools to get total NET grams, then add (1 × empty_spool_weight_g) to
 * land back in "gross weight equivalent" so the dashboard math
 * `inventory_grams - empty_spool_weight_g` still returns net. Colors
 * with no matching active spool reset to 0 grams (BamBuddy says nothing
 * is on a spool for that color).
 */
export async function syncInventory(): Promise<InventorySyncResult> {
  const bbSpools = await bbFetch<BBSpool[]>('/api/v1/inventory/spools');
  const activeSpools = bbSpools.filter((s) => !s.archived_at);

  // Group active spools by (HEX, material, manufacturer-name-lower).
  // Map value: total net grams (label_weight - weight_used) summed across spools.
  const grouped = new Map<string, number>();
  let unmatchedSpools = 0;

  for (const s of activeSpools) {
    if (!s.rgba || s.rgba.length < 6) { unmatchedSpools++; continue; }
    const hex = '#' + s.rgba.slice(0, 6).toUpperCase();
    const material = s.material;
    const mfg = s.brand.toLowerCase().trim();
    const key = `${hex}|${material}|${mfg}`;
    const remaining = Math.max(0, (s.label_weight ?? 0) - (s.weight_used ?? 0));
    grouped.set(key, (grouped.get(key) ?? 0) + remaining);
  }

  // Pull every wiz3dtools color with its manufacturer (so we can resolve
  // the (hex, material, mfg-name) lookup key the same way).
  const localColors = await pool.query<{
    id: number;
    hex: string;
    material: string | null;
    manufacturer_name: string | null;
    empty_spool_weight_g: string | null;
  }>(
    `SELECT c.id, UPPER(c.hex) as hex, c.material,
            m.name as manufacturer_name,
            m.empty_spool_weight_g
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id`,
  );

  let colorsUpdated = 0;
  let totalGrams = 0;

  for (const c of localColors.rows) {
    if (!c.manufacturer_name || !c.material) {
      // Without a manufacturer or material we can't form the key.
      // Leave inventory_grams alone for these (operator-curated rows).
      continue;
    }
    const key = `${c.hex}|${c.material}|${c.manufacturer_name.toLowerCase().trim()}`;
    const netGrams = grouped.get(key) ?? 0;
    const emptySpool = parseFloat(c.empty_spool_weight_g ?? '0') || 0;
    // Match the existing inventory_grams convention: gross = net + one empty spool weight,
    // so the UI's `inventory_grams - empty_spool_weight` calc returns net.
    const grossGrams = netGrams > 0 ? netGrams + emptySpool : 0;

    await pool.query(
      `UPDATE colors SET inventory_grams = $1, updated_at = NOW() WHERE id = $2`,
      [grossGrams, c.id],
    );
    colorsUpdated++;
    totalGrams += netGrams;
  }

  return {
    colorsUpdated,
    totalGrams,
    unmatchedSpools,
  };
}

export async function fullSync(): Promise<FullSyncResult> {
  const catalog = await syncCatalog();
  const inventory = await syncInventory();
  return {
    catalog,
    inventory,
    finishedAt: new Date().toISOString(),
  };
}

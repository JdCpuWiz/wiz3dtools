import { pool } from '../config/database.js';
import type { Color, CreateColorDto, UpdateColorDto } from '@wizqueue/shared';

const SELECT_FIELDS = `
  c.id, c.name, c.hex, c.active,
  c.material,
  c.bambuddy_id as "bambuddyId",
  c.is_multi_color as "isMultiColor",
  c.additional_hexes as "additionalHexes",
  c.sort_order as "sortOrder",
  c.manufacturer_id as "manufacturerId",
  c.inventory_grams as "inventoryGrams",
  c.created_at as "createdAt",
  c.updated_at as "updatedAt",
  CASE WHEN m.id IS NOT NULL THEN
    json_build_object(
      'id', m.id,
      'name', m.name,
      'emptySpoolWeightG', m.empty_spool_weight_g,
      'fullSpoolNetWeightG', m.full_spool_net_weight_g,
      'lowThresholdG', m.low_threshold_g,
      'criticalThresholdG', m.critical_threshold_g,
      'createdAt', m.created_at,
      'updatedAt', m.updated_at
    )
  ELSE NULL END as manufacturer
`;

function parseRow(row: Record<string, unknown>): Color {
  return {
    ...row,
    inventoryGrams: parseFloat(row.inventoryGrams as string ?? '0'),
    isMultiColor: row.isMultiColor === true,
    additionalHexes: Array.isArray(row.additionalHexes)
      ? (row.additionalHexes as string[])
      : [],
    invoiceNumbers: Array.isArray(row.invoiceNumbers)
      ? (row.invoiceNumbers as string[])
      : [],
  } as Color;
}

export class ColorModel {
  static async findAll(activeOnly = false): Promise<Color[]> {
    const where = activeOnly ? 'WHERE c.active = true' : '';
    // LEFT JOIN per-color invoice-reference count + sorted list of
    // distinct invoice numbers. Both feed the admin colors page —
    // count drives the Invoices column, list drives its hover
    // tooltip. line_item_colors → invoice_line_items → sales_invoices
    // gets us the invoice_number. DISTINCT collapses repeats from
    // multi-line invoices; DESC order so the most recent appear first.
    const result = await pool.query(
      `WITH line_refs AS (
         SELECT
           lic.color_id,
           COUNT(*)::int AS n,
           array_agg(DISTINCT si.invoice_number ORDER BY si.invoice_number DESC) AS invoice_numbers
         FROM line_item_colors lic
         JOIN invoice_line_items ili ON ili.id = lic.line_item_id
         JOIN sales_invoices     si  ON si.id  = ili.invoice_id
         GROUP BY lic.color_id
       )
       SELECT ${SELECT_FIELDS},
              COALESCE(lr.n, 0) AS "invoiceRefs",
              COALESCE(lr.invoice_numbers, ARRAY[]::TEXT[]) AS "invoiceNumbers"
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       LEFT JOIN line_refs    lr ON lr.color_id = c.id
       ${where}
       ORDER BY m.name ASC NULLS LAST, c.name ASC`,
    );
    return result.rows.map(parseRow);
  }

  static async findById(id: number): Promise<Color | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       WHERE c.id = $1`,
      [id],
    );
    return result.rows[0] ? parseRow(result.rows[0]) : null;
  }

  static async create(data: CreateColorDto): Promise<Color> {
    const result = await pool.query(
      `INSERT INTO colors
         (name, hex, active, sort_order, manufacturer_id, inventory_grams,
          is_multi_color, additional_hexes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.name,
        data.hex,
        data.active ?? true,
        data.sortOrder ?? 0,
        data.manufacturerId ?? null,
        data.inventoryGrams ?? 0,
        data.isMultiColor ?? false,
        data.additionalHexes ?? [],
      ],
    );
    return (await this.findById(result.rows[0].id))!;
  }

  static async update(id: number, data: UpdateColorDto): Promise<Color | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.hex !== undefined) { fields.push(`hex = $${i++}`); values.push(data.hex); }
    if (data.material !== undefined) { fields.push(`material = $${i++}`); values.push(data.material ?? null); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sortOrder); }
    if (data.manufacturerId !== undefined) { fields.push(`manufacturer_id = $${i++}`); values.push(data.manufacturerId ?? null); }
    if (data.inventoryGrams !== undefined) { fields.push(`inventory_grams = $${i++}`); values.push(data.inventoryGrams); }
    if (data.isMultiColor !== undefined) { fields.push(`is_multi_color = $${i++}`); values.push(data.isMultiColor); }
    if (data.additionalHexes !== undefined) { fields.push(`additional_hexes = $${i++}`); values.push(data.additionalHexes); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE colors SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`,
      values,
    );
    if (!result.rows[0]) return null;
    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    // Pre-check FK references so the user gets a clear error instead
    // of Postgres' generic "violates foreign key constraint" wrapped
    // in the error handler's "Database constraint violation" 400.
    //
    // line_item_colors.color_id is NOT NULL with no ON DELETE action
    // → the DELETE would fail at the DB layer if any invoice
    // references this color. Mirror ProductModel.delete: raise a 409
    // with an actionable message telling admin to disable instead.
    //
    // product_colors.color_id cascades — admin should know they're
    // wiping recipes if they proceed (we still allow it; the message
    // calls out the count so they can decide).
    const refs = await pool.query<{ line_refs: string; product_refs: string }>(
      `SELECT
         (SELECT COUNT(*) FROM line_item_colors WHERE color_id = $1) AS line_refs,
         (SELECT COUNT(*) FROM product_colors  WHERE color_id = $1) AS product_refs`,
      [id],
    );
    const lineRefs = parseInt(refs.rows[0]?.line_refs ?? '0', 10);
    const productRefs = parseInt(refs.rows[0]?.product_refs ?? '0', 10);

    if (lineRefs > 0) {
      const parts = [
        `Can't delete this color — it's referenced by ${lineRefs} invoice line item${lineRefs === 1 ? '' : 's'}.`,
        productRefs > 0 ? `(It's also in ${productRefs} product recipe${productRefs === 1 ? '' : 's'}.)` : '',
        'Mark it Inactive instead (Status toggle), or use the dedupe tool to fold it into another color first.',
      ].filter(Boolean).join(' ');
      const err = new Error(parts);
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const result = await pool.query('DELETE FROM colors WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // Add a full spool's net weight to a color's inventory
  static async addSpool(colorId: number): Promise<Color | null> {
    // Get manufacturer's net weight for this color (default 1000g if no manufacturer)
    const mfgResult = await pool.query(
      `SELECT COALESCE(m.full_spool_net_weight_g, 1000) as net_weight
       FROM colors c
       LEFT JOIN manufacturers m ON m.id = c.manufacturer_id
       WHERE c.id = $1`,
      [colorId],
    );
    if (!mfgResult.rows[0]) return null;
    const netWeight = parseFloat(mfgResult.rows[0].net_weight);
    await pool.query(
      `UPDATE colors SET inventory_grams = inventory_grams + $1, updated_at = NOW() WHERE id = $2`,
      [netWeight, colorId],
    );
    return this.findById(colorId);
  }

  // Deduct grams from inventory (can go negative — warning only, allowed)
  static async deductInventory(colorId: number, grams: number): Promise<void> {
    await pool.query(
      `UPDATE colors SET inventory_grams = inventory_grams - $1, updated_at = NOW() WHERE id = $2`,
      [grams, colorId],
    );
  }
}

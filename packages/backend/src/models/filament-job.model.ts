import { pool } from '../config/database.js';
import type { FilamentJob } from '@wizqueue/shared';

const SELECT_FIELDS = `
  fj.id,
  fj.printer_id      as "printerId",
  p.name             as "printerName",
  fj.job_name        as "jobName",
  fj.ams_slot_id     as "amsSlotId",
  fj.ams_color_hex   as "amsColorHex",
  fj.ams_material    as "amsMaterial",
  fj.remain_start    as "remainStart",
  fj.remain_end      as "remainEnd",
  fj.filament_grams  as "filamentGrams",
  fj.color_id        as "colorId",
  c.name             as "colorName",
  c.hex              as "colorHex",
  fj.queue_item_id   as "queueItemId",
  fj.status,
  fj.created_at      as "createdAt",
  fj.resolved_at     as "resolvedAt"
`;

export interface CreateFilamentJobDto {
  printerId?: number | null;
  jobName?: string | null;
  amsSlotId?: string | null;
  amsColorHex?: string | null;
  amsMaterial?: string | null;
  remainStart?: number | null;
  remainEnd?: number | null;
  filamentGrams?: number | null;
  colorId?: number | null;
  queueItemId?: number | null;
  status?: 'pending' | 'auto_resolved' | 'resolved' | 'skipped';
}

export class FilamentJobModel {
  static async findAll(status?: string): Promise<FilamentJob[]> {
    const where = status ? `WHERE fj.status = $1` : '';
    const params = status ? [status] : [];
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM filament_jobs fj
       LEFT JOIN printers p ON p.id = fj.printer_id
       LEFT JOIN colors c   ON c.id = fj.color_id
       ${where}
       ORDER BY fj.created_at DESC
       LIMIT 200`,
      params,
    );
    return result.rows;
  }

  static async findPending(): Promise<FilamentJob[]> {
    return this.findAll('pending');
  }

  static async countPending(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) FROM filament_jobs WHERE status = 'pending'`,
    );
    return parseInt(result.rows[0].count, 10);
  }

  static async findById(id: number): Promise<FilamentJob | null> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM filament_jobs fj
       LEFT JOIN printers p ON p.id = fj.printer_id
       LEFT JOIN colors c   ON c.id = fj.color_id
       WHERE fj.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(data: CreateFilamentJobDto): Promise<FilamentJob> {
    const result = await pool.query(
      `INSERT INTO filament_jobs
         (printer_id, job_name, ams_slot_id, ams_color_hex, ams_material,
          remain_start, remain_end, filament_grams, color_id, queue_item_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        data.printerId ?? null,
        data.jobName ?? null,
        data.amsSlotId ?? null,
        data.amsColorHex ?? null,
        data.amsMaterial ?? null,
        data.remainStart ?? null,
        data.remainEnd ?? null,
        data.filamentGrams ?? null,
        data.colorId ?? null,
        data.queueItemId ?? null,
        data.status ?? 'pending',
      ],
    );
    return this.findById(result.rows[0].id) as Promise<FilamentJob>;
  }

  // Returns all filament_job rows that belong to the most recently completed
  // job for a given printer (matched by job_name).
  static async findLastByPrinter(printerName: string): Promise<FilamentJob[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM filament_jobs fj
       LEFT JOIN printers p ON p.id = fj.printer_id
       LEFT JOIN colors c   ON c.id = fj.color_id
       WHERE p.name = $1
         AND fj.status IN ('auto_resolved', 'resolved', 'skipped')
         AND fj.job_name IS NOT NULL
         AND fj.job_name = (
           SELECT fj2.job_name FROM filament_jobs fj2
           LEFT JOIN printers p2 ON p2.id = fj2.printer_id
           WHERE p2.name = $1
             AND fj2.status IN ('auto_resolved', 'resolved', 'skipped')
             AND fj2.job_name IS NOT NULL
           ORDER BY fj2.created_at DESC LIMIT 1
         )
       ORDER BY fj.created_at DESC`,
      [printerName],
    );
    return result.rows;
  }

  // Returns all filament_job rows linked to a specific queue item.
  static async findByQueueItem(queueItemId: number): Promise<FilamentJob[]> {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM filament_jobs fj
       LEFT JOIN printers p ON p.id = fj.printer_id
       LEFT JOIN colors c   ON c.id = fj.color_id
       WHERE fj.queue_item_id = $1
         AND fj.status IN ('auto_resolved', 'resolved', 'skipped')
       ORDER BY fj.created_at ASC`,
      [queueItemId],
    );
    return result.rows;
  }

  static async resolve(id: number, colorId: number, filamentGrams: number): Promise<FilamentJob | null> {
    const result = await pool.query(
      `UPDATE filament_jobs
       SET color_id = $1, filament_grams = $2, status = 'resolved', resolved_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING id`,
      [colorId, filamentGrams, id],
    );
    if (!result.rowCount) return null;
    return this.findById(id);
  }

  static async skip(id: number): Promise<FilamentJob | null> {
    const result = await pool.query(
      `UPDATE filament_jobs SET status = 'skipped', resolved_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id],
    );
    if (!result.rowCount) return null;
    return this.findById(id);
  }
}

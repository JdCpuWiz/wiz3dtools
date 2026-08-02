import path from 'path';
import fsPromises from 'fs/promises';
import sharp from 'sharp';
import { pool } from '../config/database.js';
import { ProductImageMaskModel } from '../models/product-image-mask.model.js';
import { deriveMaskFromProcessedImage } from './image-processing.service.js';
import type { ProductImageMask, BulkMaskJob } from '@wizqueue/shared';

const PUBLIC_BASE = () => process.env.STORE_IMAGE_PUBLIC_BASE || '/uploads/store';
const MASKS_DIR = () => path.resolve(process.env.UPLOAD_DIR || './uploads', 'store', 'masks');
// Replaced masks are retained here for 30 days (BP17 Phase 4 versioning) so an
// accidental upload is recoverable — restore by copying the file back into
// masks/ and re-pointing the row, or just re-upload the correct mask.
const ARCHIVE_DIR = () => path.join(MASKS_DIR(), 'archive');
const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Move a replaced/deleted mask file into the archive with a replaced-at stamp. */
async function archiveMaskFile(url: string): Promise<void> {
  await fsPromises.mkdir(ARCHIVE_DIR(), { recursive: true });
  const filename = path.basename(url);
  const from = diskPathFromUrl(url);
  const to = path.join(ARCHIVE_DIR(), `${filename}.replaced-${Date.now()}`);
  await fsPromises.rename(from, to).catch(() => {});
}

/** Opportunistic cleanup: drop archived masks past the 30-day retention. */
async function cleanMaskArchive(): Promise<void> {
  try {
    const entries = await fsPromises.readdir(ARCHIVE_DIR());
    const cutoff = Date.now() - ARCHIVE_RETENTION_MS;
    for (const entry of entries) {
      const stamp = Number(entry.match(/\.replaced-(\d+)$/)?.[1]);
      if (stamp && stamp < cutoff) {
        await fsPromises.unlink(path.join(ARCHIVE_DIR(), entry)).catch(() => {});
      }
    }
  } catch {
    // archive dir may not exist yet — nothing to clean
  }
}

/** Resolve a product_images.url (or mask url) back to its file on disk. */
function diskPathFromUrl(url: string): string {
  const filename = path.basename(url);
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  return url.includes('/masks/')
    ? path.resolve(uploadDir, 'store', 'masks', filename)
    : path.resolve(uploadDir, 'store', filename);
}

/**
 * Persist a mask PNG buffer for (image, slot): write file, upsert row,
 * unlink the replaced file. Timestamped filename so a replaced mask never
 * serves stale from browser cache.
 */
export async function saveMask(
  imageId: number,
  slotIndex: number,
  maskPng: Buffer,
  source: ProductImageMask['source'],
): Promise<ProductImageMask> {
  await fsPromises.mkdir(MASKS_DIR(), { recursive: true });
  const filename = `image-${imageId}-mask-${slotIndex}-${Date.now()}.png`;
  await fsPromises.writeFile(path.join(MASKS_DIR(), filename), maskPng);

  const url = `${PUBLIC_BASE()}/masks/${filename}`;
  const { mask, previousUrl } = await ProductImageMaskModel.upsert(imageId, slotIndex, url, source);
  if (previousUrl && previousUrl !== url) {
    await archiveMaskFile(previousUrl);
  }
  void cleanMaskArchive();
  return mask;
}

/**
 * BP17 Phase 4 — validate + normalize a manually-prepared mask PNG and persist
 * it for (image, slot). Accepts any PNG with an alpha channel (Photoshop /
 * GIMP / Procreate export) and normalizes it to the canonical white-RGB +
 * alpha format. Resolution is not enforced: the compositor scales masks to
 * the base frame, so a mismatched export still works.
 */
export async function saveManualMask(
  imageId: number,
  slotIndex: number,
  pngBuffer: Buffer,
): Promise<ProductImageMask> {
  const meta = await sharp(pngBuffer).metadata();
  if (meta.format !== 'png') {
    throw Object.assign(new Error('Mask must be a PNG file'), { statusCode: 400 });
  }
  if (!meta.hasAlpha) {
    throw Object.assign(
      new Error('Mask PNG has no alpha channel — export with transparency (the painted area is the mask)'),
      { statusCode: 400 },
    );
  }
  const alphaPng = await sharp(pngBuffer).ensureAlpha().extractChannel('alpha').png().toBuffer();
  const stats = await sharp(alphaPng).stats();
  const meanAlpha = stats.channels[0].mean;
  if (meanAlpha < 3) {
    throw Object.assign(new Error('Mask alpha is empty — nothing is painted'), { statusCode: 400 });
  }
  if (meanAlpha > 250) {
    throw Object.assign(new Error('Mask alpha covers the whole frame — the mask should cover only this slot’s area'), { statusCode: 400 });
  }

  const normalized = await sharp({
    create: { width: meta.width!, height: meta.height!, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .joinChannel(alphaPng)
    .png()
    .toBuffer();

  return saveMask(imageId, slotIndex, normalized, 'MANUAL_UPLOAD');
}

/** BP17 Phase 4 — remove one slot's mask (row deleted, file archived for 30 days). */
export async function deleteMask(imageId: number, slotIndex: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM product_image_masks WHERE image_id = $1 AND slot_index = $2 RETURNING url',
    [imageId, slotIndex],
  );
  if (!result.rows[0]) return false;
  await archiveMaskFile(result.rows[0].url as string);
  return true;
}

/** rembg → validate → persist, for one already-uploaded image. */
export async function generateMaskForImage(
  imageId: number,
  imageUrl: string,
): Promise<ProductImageMask> {
  const maskPng = await deriveMaskFromProcessedImage(diskPathFromUrl(imageUrl));
  return saveMask(imageId, 0, maskPng, 'AUTO_REMBG');
}

/** Remove all mask files for an image (rows cascade with the image delete). */
export async function deleteMaskFiles(imageId: number): Promise<void> {
  const masks = await ProductImageMaskModel.findByImage(imageId);
  await Promise.all(masks.map((m) => fsPromises.unlink(diskPathFromUrl(m.url)).catch(() => {})));
}

/** Does this product have exactly one recipe slot (single-color)? */
export async function isSingleColorProduct(productId: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM product_colors WHERE product_id = $1',
    [productId],
  );
  return result.rows[0].count === 1;
}

// ---------------------------------------------------------------------------
// Bulk job — in-process with status polling. This repo has no job queue
// (the BuildPlan's BullMQ assumption predates checking), and ~20 images at
// ~1-2s each doesn't warrant adding one. State is per-process; a backend
// restart mid-job just means re-running the (idempotent) bulk action.
// ---------------------------------------------------------------------------

const jobs = new Map<string, BulkMaskJob>();
let bulkRunning = false;

export function getBulkJob(id: string): BulkMaskJob | null {
  return jobs.get(id) ?? null;
}

/**
 * Generate slot-0 masks for every image of a single-color product that has
 * none yet. Returns the job immediately; work continues in-process with
 * 3-way concurrency. Rejects a second concurrent run.
 */
export async function startBulkMaskJob(): Promise<BulkMaskJob> {
  if (bulkRunning) throw Object.assign(new Error('A bulk mask job is already running'), { statusCode: 409 });

  const targets = await ProductImageMaskModel.findUnmaskedSingleColorImages();
  const job: BulkMaskJob = {
    id: `bulk-${Date.now()}`,
    status: targets.length === 0 ? 'done' : 'running',
    total: targets.length,
    completed: 0,
    failed: [],
    startedAt: new Date().toISOString(),
  };
  // Keep only the most recent few jobs around for late polls
  for (const key of [...jobs.keys()].slice(0, -4)) jobs.delete(key);
  jobs.set(job.id, job);
  if (targets.length === 0) return job;

  bulkRunning = true;
  void (async () => {
    const queue = [...targets];
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        try {
          await generateMaskForImage(t.imageId, t.url);
        } catch (err) {
          job.failed.push({
            imageId: t.imageId,
            productName: t.productName,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          job.completed++;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    job.status = 'done';
    bulkRunning = false;
  })();

  return job;
}

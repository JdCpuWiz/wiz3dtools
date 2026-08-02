import path from 'path';
import fsPromises from 'fs/promises';
import { pool } from '../config/database.js';
import { ProductImageMaskModel } from '../models/product-image-mask.model.js';
import { deriveMaskFromProcessedImage } from './image-processing.service.js';
import type { ProductImageMask, BulkMaskJob } from '@wizqueue/shared';

const PUBLIC_BASE = () => process.env.STORE_IMAGE_PUBLIC_BASE || '/uploads/store';
const MASKS_DIR = () => path.resolve(process.env.UPLOAD_DIR || './uploads', 'store', 'masks');

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
    await fsPromises.unlink(diskPathFromUrl(previousUrl)).catch(() => {});
  }
  return mask;
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

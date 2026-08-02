import sharp from 'sharp';
import fsPromises from 'fs/promises';
import path from 'path';

const OUTPUT_SIZE = 800;  // Final square image dimension
const SUBJECT_MAX = 672;  // Subject fills 84% of frame — leaves comfortable padding

/**
 * Find tight bounding box of visible (non-transparent) pixels in an RGBA buffer.
 * Returns full image bounds if nothing is opaque (fallback).
 */
function findBoundingBox(
  data: Buffer,
  w: number,
  h: number,
): { left: number; top: number; width: number; height: number } {
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX) return { left: 0, top: 0, width: w, height: h };
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * SVG radial gradient background: dark charcoal with subtle lighter center,
 * giving a soft studio-light depth without being obvious.
 * Center: #262628 — Mid: #1e1e20 — Edge: #131315
 */
function makeBackgroundSvg(size: number): Buffer {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="44%" r="66%">
          <stop offset="0%"   stop-color="#262628"/>
          <stop offset="58%"  stop-color="#1e1e20"/>
          <stop offset="100%" stop-color="#131315"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
    </svg>`,
  );
}

/**
 * Generate a raw RGBA noise overlay.
 * Mid-gray pixels at ~5.5% opacity create the heather/grain texture
 * without changing the overall colour temperature.
 * Slight +3 blue offset gives a cool, smoky feel.
 */
function makeNoiseOverlay(size: number): Buffer {
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const n = Math.round((Math.random() - 0.5) * 16);
    const v = Math.max(0, Math.min(255, 128 + n));
    pixels[i * 4]     = v;
    pixels[i * 4 + 1] = v;
    pixels[i * 4 + 2] = Math.min(255, v + 3); // slight cool tint
    pixels[i * 4 + 3] = 14;                    // ~5.5% opacity
  }
  return Buffer.from(pixels.buffer);
}

/**
 * Wrap a cutout's alpha channel into the mask format stored on disk:
 * white RGB + the silhouette in the ALPHA channel (BP17 spike convention —
 * the storefront compositor reads only the alpha).
 *
 * Rejects degenerate masks: an all-transparent alpha means rembg found no
 * subject; a near-fully-opaque one means it failed to find the background.
 * Both would silently produce a broken color preview, so they throw instead.
 */
async function cutoutAlphaToMaskPng(cutoutRgba: Buffer): Promise<Buffer> {
  const alpha = sharp(cutoutRgba).ensureAlpha().extractChannel('alpha');
  const { width, height } = await alpha.metadata();
  if (!width || !height) throw new Error('mask: could not read cutout dimensions');

  const alphaPng = await alpha.png().toBuffer();
  const stats = await sharp(alphaPng).stats();
  const meanAlpha = stats.channels[0].mean;
  if (meanAlpha < 3) throw new Error('mask: empty alpha — rembg found no subject');
  if (meanAlpha > 250) throw new Error('mask: alpha covers whole frame — rembg found no background');

  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .joinChannel(alphaPng)
    .png()
    .toBuffer();
}

/**
 * Derive a slot-0 silhouette mask for an ALREADY-PROCESSED product image
 * (the 800×800 dark-backdrop webp). Runs rembg on the processed file, so the
 * mask is aligned to the frame customers actually see. Used by the BP17
 * on-demand / bulk mask endpoints for images uploaded before masks existed.
 */
export async function deriveMaskFromProcessedImage(imagePath: string): Promise<Buffer> {
  const rembgUrl = `${process.env.REMBG_URL ?? 'http://rembg:7000'}/api/remove`;
  const inputBuffer = await fsPromises.readFile(imagePath);
  const form = new FormData();
  form.append('file', new Blob([inputBuffer]), path.basename(imagePath));
  const rembgResponse = await fetch(rembgUrl, { method: 'POST', body: form });
  if (!rembgResponse.ok) {
    throw new Error(`rembg API returned ${rembgResponse.status}: ${await rembgResponse.text()}`);
  }
  const cutout = Buffer.from(await rembgResponse.arrayBuffer());
  return cutoutAlphaToMaskPng(cutout);
}

/**
 * Full image processing pipeline:
 *   1. Remove background (rembg sidecar)
 *   2. Auto-crop to visible subject
 *   3. Resize subject to fit within 672×672 (with transparency padding)
 *   4. Composite onto 800×800 dark charcoal + heather background
 *   5. Export as WebP quality-85
 *
 * Returns the processed file's path plus a slot-0 silhouette mask (white PNG
 * with the subject in the alpha channel) in the SAME 800×800 frame as the
 * processed image — the cutout is already computed here, so the mask is a
 * free byproduct (BP17 Phase 3). maskPng is null when the mask came out
 * degenerate; the upload still succeeds and the admin can retry on demand.
 *
 * Throws on processing failure — caller should fall back to original.
 */
export async function processProductImage(
  inputPath: string,
): Promise<{ processedPath: string; maskPng: Buffer | null }> {
  const ext = path.extname(inputPath).toLowerCase();

  // 1. Remove background via rembg sidecar.
  // rembg expects multipart/form-data with a field named "file".
  const rembgUrl = `${process.env.REMBG_URL ?? 'http://rembg:7000'}/api/remove`;
  const inputBuffer = await fsPromises.readFile(inputPath);
  const form = new FormData();
  form.append('file', new Blob([inputBuffer]), `image${ext}`);
  const rembgResponse = await fetch(rembgUrl, { method: 'POST', body: form });
  if (!rembgResponse.ok) {
    throw new Error(`rembg API returned ${rembgResponse.status}: ${await rembgResponse.text()}`);
  }
  const transparentBuffer = Buffer.from(await rembgResponse.arrayBuffer());

  // 2. Scan raw pixels to find tight bounding box of the subject
  const { data, info } = await sharp(transparentBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bbox = findBoundingBox(data, info.width, info.height);

  // 3. Crop to bounding box, then fit subject inside SUBJECT_MAX square
  const subjectBuffer = await sharp(transparentBuffer)
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .resize(SUBJECT_MAX, SUBJECT_MAX, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // 4. Build background: radial gradient + heather noise overlay
  const noiseBuffer = await sharp(makeNoiseOverlay(OUTPUT_SIZE), {
    raw: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 4 },
  }).png().toBuffer();

  const backgroundBuffer = await sharp(makeBackgroundSvg(OUTPUT_SIZE))
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .composite([{ input: noiseBuffer, blend: 'over' }])
    .png()
    .toBuffer();

  // 5. Composite subject centred on background → WebP
  const outputBuffer = await sharp(backgroundBuffer)
    .composite([{ input: subjectBuffer, gravity: 'centre' }])
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  // 6. Write processed file alongside original
  const outputPath = `${inputPath.slice(0, -ext.length)}-processed.webp`;
  await fsPromises.writeFile(outputPath, outputBuffer);

  // 7. Mask byproduct: the subject cutout composited onto a TRANSPARENT
  // 800×800 canvas goes through the exact same geometry as step 5, so its
  // alpha is pixel-aligned with the processed image.
  let maskPng: Buffer | null = null;
  try {
    const fullFrameCutout = await sharp({
      create: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: subjectBuffer, gravity: 'centre' }])
      .png()
      .toBuffer();
    maskPng = await cutoutAlphaToMaskPng(fullFrameCutout);
  } catch (err) {
    console.error('[image-processing] mask byproduct failed (upload continues):', err);
  }

  return { processedPath: outputPath, maskPng };
}

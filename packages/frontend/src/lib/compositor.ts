/**
 * BP17 — canvas compositor for the dynamic product color preview.
 *
 * Blend mode: MULTIPLY (chosen in the Phase 1 spike — 5/5 test colors read
 * as real photos on the near-white base prints; color-burn hue-shifts and
 * luminance-preserve clips highlights). Recolored pixels are blended back
 * over the original by mask alpha, so soft mask edges anti-alias for free.
 *
 * This module is the reference implementation the wiz3d-prints storefront
 * <ProductRenderer> (Phase 6) ships a copy of — keep the math in sync.
 */

export interface SlotMaskImage {
  slotIndex: number;
  image: HTMLImageElement | ImageBitmap;
}

type ImageLike = HTMLImageElement | ImageBitmap;

const imgWidth = (img: ImageLike) => (img instanceof HTMLImageElement ? img.naturalWidth : img.width);
const imgHeight = (img: ImageLike) => (img instanceof HTMLImageElement ? img.naturalHeight : img.height);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Rasterize an image to the target frame's pixel data (masks may be any resolution). */
function toFrameData(img: ImageLike, w: number, h: number): ImageData {
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Recolor the base photo: for each slot, multiply the base by that slot's
 * color inside the mask alpha. Renders into `canvas` at the base image's
 * natural resolution. Returns the composite time in ms.
 */
export function compositeColors(
  canvas: HTMLCanvasElement,
  base: ImageLike,
  masks: SlotMaskImage[],
  colors: Map<number, string>,
): number {
  const t0 = performance.now();
  const w = imgWidth(base);
  const h = imgHeight(base);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const out = toFrameData(base, w, h);
  const d = out.data;

  for (const { slotIndex, image } of masks) {
    const hex = colors.get(slotIndex);
    if (!hex) continue;
    const [cr, cg, cb] = hexToRgb(hex);
    const maskData = toFrameData(image, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      const a = maskData[i + 3] / 255;
      if (a === 0) continue;
      d[i] = d[i] + ((d[i] * cr) / 255 - d[i]) * a;
      d[i + 1] = d[i + 1] + ((d[i + 1] * cg) / 255 - d[i + 1]) * a;
      d[i + 2] = d[i + 2] + ((d[i + 2] * cb) / 255 - d[i + 2]) * a;
    }
  }

  ctx.putImageData(out, 0, 0);
  return performance.now() - t0;
}

/** Slot-assignment overlay tints (Phase 4 preview): red / blue / green / yellow, then cycle. */
export const OVERLAY_TINTS = ['#ff3b30', '#007aff', '#34c759', '#ffcc00'];

/**
 * Verification overlay: each uploaded mask tinted a distinct solid color at
 * 50% over the base photo, so wrong slot assignment / wrong coverage is
 * obvious at a glance.
 */
export function compositeOverlay(
  canvas: HTMLCanvasElement,
  base: ImageLike,
  masks: SlotMaskImage[],
): number {
  const t0 = performance.now();
  const w = imgWidth(base);
  const h = imgHeight(base);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const out = toFrameData(base, w, h);
  const d = out.data;

  for (const { slotIndex, image } of masks) {
    const [tr, tg, tb] = hexToRgb(OVERLAY_TINTS[slotIndex % OVERLAY_TINTS.length]);
    const maskData = toFrameData(image, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      const a = (maskData[i + 3] / 255) * 0.5;
      if (a === 0) continue;
      d[i] = d[i] + (tr - d[i]) * a;
      d[i + 1] = d[i + 1] + (tg - d[i + 1]) * a;
      d[i + 2] = d[i + 2] + (tb - d[i + 2]) * a;
    }
  }

  ctx.putImageData(out, 0, 0);
  return performance.now() - t0;
}

/** Load an image URL ready for canvas reads (CORS-safe against the uploads host). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

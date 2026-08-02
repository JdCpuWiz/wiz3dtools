import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fsPromises from 'fs/promises';
import { ProductService } from '../services/product.service.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { ProductImageModel } from '../models/product-image.model.js';
import { processProductImage } from '../services/image-processing.service.js';
import {
  saveMask,
  saveManualMask,
  deleteMask,
  generateMaskForImage,
  deleteMaskFiles,
  isSingleColorProduct,
  startBulkMaskJob,
  getBulkJob,
} from '../services/mask-generator.service.js';
import { parseBody, createProductSchema, updateProductSchema, setProductColorsSchema } from '../validation/schemas.js';
import type { ApiResponse } from '@wizqueue/shared';

const service = new ProductService();

export class ProductController {
  async getAll(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const products = await service.getAll(activeOnly);
      res.json({ success: true, data: products });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const product = await service.getById(id);
      res.json({ success: true, data: product });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(createProductSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const product = await service.create(parsed.data);
      res.status(201).json({ success: true, data: product, message: 'Product created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateProductSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const product = await service.update(id, parsed.data);
      res.json({ success: true, data: product, message: 'Product updated' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.delete(id);
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) { next(error); }
  }

  async getColors(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const colors = await ProductColorModel.findByProduct(id);
      res.json({ success: true, data: colors });
    } catch (error) { next(error); }
  }

  async setColors(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(setProductColorsSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }

      // Wholesale-storefront invariant: emptying the recipe of a
      // published+active product would silently hide it from the storefront
      // (StoreService.getProducts filters by published_to_store=TRUE AND
      // active=TRUE, and createOrder requires ≥1 recipe slot). Reject up
      // front so the admin sees the constraint instead of a downstream
      // silent disappearance.
      if (parsed.data.colors.length === 0) {
        const product = await service.getById(id);
        if (product.publishedToStore && product.active) {
          res.status(400).json({
            success: false,
            error: 'Cannot remove all recipe slots from a product that is published to the wholesale store. Uncheck "Published to store" first, then clear the recipe.',
          });
          return;
        }
      }

      const colors = await ProductColorModel.setColors(id, parsed.data.colors);
      res.json({ success: true, data: colors, message: 'Product colors updated' });
    } catch (error) { next(error); }
  }

  async copy(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const product = await service.copy(id);
      res.status(201).json({ success: true, data: product, message: 'Product copied' });
    } catch (error) { next(error); }
  }

  async uploadImage(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      if (!req.file) { res.status(400).json({ success: false, error: 'No image file provided' }); return; }

      const baseUrl = process.env.STORE_IMAGE_PUBLIC_BASE || '/uploads/store';

      // Process image: remove background, crop, resize, composite onto dark heathered background.
      // Falls back to original if processing fails so uploads never get silently blocked.
      let finalFilename = req.file.filename;
      let maskPng: Buffer | null = null;
      try {
        const processed = await processProductImage(req.file.path);
        finalFilename = path.basename(processed.processedPath);
        maskPng = processed.maskPng;
        // Remove original now that we have the processed version
        await fsPromises.unlink(req.file.path).catch(() => {});
      } catch (err) {
        console.error('[image-processing] failed, using original:', err);
      }

      const url = `${baseUrl}/${finalFilename}`;
      const image = await ProductImageModel.create(id, url);

      // BP17 Phase 3 — the pipeline already computed the silhouette, so a
      // single-color product gets its slot-0 mask for free at upload time.
      // Failure here never fails the upload; the admin can generate on demand.
      if (maskPng && (await isSingleColorProduct(id))) {
        try {
          image.masks = [await saveMask(image.id, 0, maskPng, 'AUTO_REMBG')];
        } catch (err) {
          console.error('[mask-generator] upload-time mask save failed:', err);
        }
      }

      res.status(201).json({ success: true, data: image });
    } catch (error) { next(error); }
  }

  async reorderImages(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const { order } = req.body as { order: number[] };
      if (!Array.isArray(order)) { res.status(400).json({ success: false, error: 'order must be an array of image IDs' }); return; }
      await ProductImageModel.reorder(id, order);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  async setPrimaryImage(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      if (isNaN(id) || isNaN(imageId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const ok = await ProductImageModel.setPrimary(id, imageId);
      if (!ok) { res.status(404).json({ success: false, error: 'Image not found' }); return; }
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  async deleteImage(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      if (isNaN(id) || isNaN(imageId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      // Mask rows cascade with the image row, but their files don't — unlink first
      await deleteMaskFiles(imageId).catch(() => {});

      const deleted = await ProductImageModel.delete(id, imageId);
      if (!deleted) { res.status(404).json({ success: false, error: 'Image not found' }); return; }

      // Remove file from disk
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filename = path.basename(deleted.url);
      const filePath = path.resolve(uploadDir, 'store', filename);
      await fsPromises.unlink(filePath).catch(() => { /* ignore if already gone */ });

      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // BP17 Phase 3 — generate (or regenerate) the slot-0 silhouette mask for one image.
  async generateImageMask(req: Request, res: Response<ApiResponse>, _next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      if (isNaN(id) || isNaN(imageId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

      const images = await ProductImageModel.findByProduct(id);
      const image = images.find((img) => img.id === imageId);
      if (!image) { res.status(404).json({ success: false, error: 'Image not found' }); return; }

      if (!(await isSingleColorProduct(id))) {
        res.status(400).json({
          success: false,
          error: 'Auto-generate only works for single-color products (exactly one recipe slot). Multi-color products need per-slot masks (uploaded manually).',
        });
        return;
      }

      const mask = await generateMaskForImage(imageId, image.url);
      res.json({ success: true, data: mask, message: 'Mask generated' });
    } catch (error) {
      // rembg/validation failures come back as plain errors — surface the
      // message so the admin sees WHY (empty alpha, sidecar down, …) instead
      // of a generic 500.
      const message = error instanceof Error ? error.message : 'Mask generation failed';
      res.status(422).json({ success: false, error: message });
    }
  }

  // BP17 Phase 4 — manual mask upload for one (image, slot). PNG with alpha required.
  async uploadImageMask(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      const slotIndex = parseInt(req.params.slotIndex);
      if (isNaN(id) || isNaN(imageId) || isNaN(slotIndex) || slotIndex < 0) {
        res.status(400).json({ success: false, error: 'Invalid ID' });
        return;
      }
      if (!req.file?.buffer) { res.status(400).json({ success: false, error: 'No mask file provided' }); return; }

      const images = await ProductImageModel.findByProduct(id);
      if (!images.some((img) => img.id === imageId)) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }
      const recipe = await ProductColorModel.findByProduct(id);
      if (slotIndex >= recipe.length) {
        res.status(400).json({
          success: false,
          error: `Slot ${slotIndex} does not exist — this product's recipe has ${recipe.length} slot(s)`,
        });
        return;
      }

      const mask = await saveManualMask(imageId, slotIndex, req.file.buffer);
      res.status(201).json({ success: true, data: mask, message: 'Mask uploaded' });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 400) {
        res.status(400).json({ success: false, error: (error as Error).message });
        return;
      }
      next(error);
    }
  }

  // BP17 Phase 4 — remove one slot's mask (file archived for 30 days).
  async deleteImageMask(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      const slotIndex = parseInt(req.params.slotIndex);
      if (isNaN(id) || isNaN(imageId) || isNaN(slotIndex)) {
        res.status(400).json({ success: false, error: 'Invalid ID' });
        return;
      }
      const images = await ProductImageModel.findByProduct(id);
      if (!images.some((img) => img.id === imageId)) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }
      const removed = await deleteMask(imageId, slotIndex);
      if (!removed) { res.status(404).json({ success: false, error: 'Mask not found' }); return; }
      res.json({ success: true, message: 'Mask removed' });
    } catch (error) { next(error); }
  }

  // BP17 Phase 3 — one-button backfill for every unmasked single-color product image.
  async bulkGenerateMasks(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const job = await startBulkMaskJob();
      res.status(202).json({ success: true, data: job });
    } catch (error) { next(error); }
  }

  async getMaskJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const job = getBulkJob(req.params.jobId);
      if (!job) { res.status(404).json({ success: false, error: 'Job not found' }); return; }
      res.json({ success: true, data: job });
    } catch (error) { next(error); }
  }

  async suggestSku(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const name = (req.query.name as string) || '';
      if (!name.trim()) { res.status(400).json({ success: false, error: 'name query param required' }); return; }
      const excludeId = req.query.excludeId ? parseInt(req.query.excludeId as string) : undefined;
      const sku = await service.suggestSku(name, excludeId);
      res.json({ success: true, data: sku });
    } catch (error) { next(error); }
  }
}

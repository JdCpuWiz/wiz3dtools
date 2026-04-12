import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fsPromises from 'fs/promises';
import { ProductService } from '../services/product.service.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { ProductImageModel } from '../models/product-image.model.js';
import { processProductImage } from '../services/image-processing.service.js';
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
      try {
        const processedPath = await processProductImage(req.file.path);
        finalFilename = path.basename(processedPath);
        // Remove original now that we have the processed version
        await fsPromises.unlink(req.file.path).catch(() => {});
      } catch (err) {
        console.error('[image-processing] failed, using original:', err);
      }

      const url = `${baseUrl}/${finalFilename}`;
      const image = await ProductImageModel.create(id, url);
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

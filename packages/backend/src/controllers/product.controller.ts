import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service.js';
import { ProductColorModel } from '../models/product-color.model.js';
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

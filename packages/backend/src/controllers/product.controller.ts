import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service.js';
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
      const product = await service.create(req.body);
      res.status(201).json({ success: true, data: product, message: 'Product created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const product = await service.update(id, req.body);
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
}

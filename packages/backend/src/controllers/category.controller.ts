import type { Request, Response } from 'express';
import { CategoryModel } from '../models/category.model.js';

export class CategoryController {
  static async list(_req: Request, res: Response): Promise<void> {
    const categories = await CategoryModel.findAll();
    res.json({ success: true, data: categories });
  }

  static async get(req: Request, res: Response): Promise<void> {
    const category = await CategoryModel.findById(Number(req.params.id));
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true, data: category });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { name, slug, description, sortOrder } = req.body as {
      name: string; slug: string; description?: string; sortOrder?: number;
    };
    if (!name?.trim() || !slug?.trim()) {
      res.status(400).json({ success: false, error: 'name and slug are required' });
      return;
    }
    const existing = await CategoryModel.findBySlug(slug.trim());
    if (existing) {
      res.status(409).json({ success: false, error: 'A category with this slug already exists' });
      return;
    }
    const category = await CategoryModel.create({ name: name.trim(), slug: slug.trim(), description, sortOrder });
    res.status(201).json({ success: true, data: category });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { name, slug, description, sortOrder } = req.body as {
      name?: string; slug?: string; description?: string; sortOrder?: number;
    };
    if (slug) {
      const existing = await CategoryModel.findBySlug(slug.trim());
      if (existing && existing.id !== Number(req.params.id)) {
        res.status(409).json({ success: false, error: 'A category with this slug already exists' });
        return;
      }
    }
    const category = await CategoryModel.update(Number(req.params.id), {
      name: name?.trim(),
      slug: slug?.trim(),
      description,
      sortOrder,
    });
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true, data: category });
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const deleted = await CategoryModel.delete(Number(req.params.id));
    if (!deleted) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true });
  }
}

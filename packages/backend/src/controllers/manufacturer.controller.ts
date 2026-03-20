import { Request, Response, NextFunction } from 'express';
import { ManufacturerModel } from '../models/manufacturer.model.js';
import { parseBody } from '../validation/schemas.js';
import { createManufacturerSchema, updateManufacturerSchema } from '../validation/schemas.js';
import type { ApiResponse } from '@wizqueue/shared';

export class ManufacturerController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const manufacturers = await ManufacturerModel.findAll();
      res.json({ success: true, data: manufacturers });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const mfg = await ManufacturerModel.findById(id);
      if (!mfg) { res.status(404).json({ success: false, error: 'Manufacturer not found' }); return; }
      res.json({ success: true, data: mfg });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(createManufacturerSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const mfg = await ManufacturerModel.create(parsed.data);
      res.status(201).json({ success: true, data: mfg, message: 'Manufacturer created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateManufacturerSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const mfg = await ManufacturerModel.update(id, parsed.data);
      if (!mfg) { res.status(404).json({ success: false, error: 'Manufacturer not found' }); return; }
      res.json({ success: true, data: mfg, message: 'Manufacturer updated' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const deleted = await ManufacturerModel.delete(id);
      if (!deleted) { res.status(404).json({ success: false, error: 'Manufacturer not found' }); return; }
      res.json({ success: true, message: 'Manufacturer deleted' });
    } catch (error) { next(error); }
  }
}

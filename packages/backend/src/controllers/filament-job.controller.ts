import { Request, Response, NextFunction } from 'express';
import { FilamentJobModel } from '../models/filament-job.model.js';
import { ColorModel } from '../models/color.model.js';
import type { ApiResponse } from '@wizqueue/shared';

export class FilamentJobController {
  async getAll(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const jobs = await FilamentJobModel.findAll(typeof status === 'string' ? status : undefined);
      const pendingCount = await FilamentJobModel.countPending();
      res.json({ success: true, data: jobs, meta: { pendingCount } } as any);
    } catch (error) { next(error); }
  }

  // Called by bambu-monitor to create a new filament job.
  // If status=auto_resolved and colorId + filamentGrams are provided, deducts inventory immediately.
  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.userId !== 0) {
        res.status(403).json({ success: false, error: 'Service token required' }); return;
      }

      const job = await FilamentJobModel.create(req.body);

      // Auto-deduct for auto_resolved jobs
      if (
        req.body.status === 'auto_resolved' &&
        req.body.colorId &&
        req.body.filamentGrams > 0
      ) {
        await ColorModel.deductInventory(req.body.colorId, req.body.filamentGrams);
      }

      res.status(201).json({ success: true, data: job });
    } catch (error) { next(error); }
  }

  // Manual resolution: user picks a color → calculates grams from remain delta → deducts
  async resolve(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

      const { colorId } = req.body;
      if (!colorId || isNaN(parseInt(colorId))) {
        res.status(400).json({ success: false, error: 'colorId is required' }); return;
      }

      const job = await FilamentJobModel.findById(id);
      if (!job) { res.status(404).json({ success: false, error: 'Job not found' }); return; }
      if (job.status !== 'pending') {
        res.status(400).json({ success: false, error: 'Job is not pending' }); return;
      }

      const color = await ColorModel.findById(parseInt(colorId));
      if (!color) { res.status(404).json({ success: false, error: 'Color not found' }); return; }

      const fullNetWeight = (color as any).manufacturer?.fullSpoolNetWeightG ?? 1000;
      const remainDelta = (job.remainStart ?? 0) - (job.remainEnd ?? 0);
      const grams = parseFloat(((remainDelta / 100) * fullNetWeight).toFixed(2));

      if (grams > 0) {
        await ColorModel.deductInventory(parseInt(colorId), grams);
      }

      const updated = await FilamentJobModel.resolve(id, parseInt(colorId), grams);
      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  }

  async skip(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const updated = await FilamentJobModel.skip(id);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Job not found or not pending' }); return;
      }
      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  }
}

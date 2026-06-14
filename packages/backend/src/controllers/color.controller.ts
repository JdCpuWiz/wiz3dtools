import { Request, Response, NextFunction } from 'express';
import { ColorModel } from '../models/color.model.js';
import { LineItemColorModel } from '../models/item-color.model.js';
import { parseBody, createColorSchema, updateColorSchema, setItemColorsSchema, mergeColorsSchema } from '../validation/schemas.js';
import { fullSync } from '../services/bambuddy-sync.service.js';
import { findDuplicates, mergeColors } from '../services/color-dedupe.service.js';
import type { ApiResponse } from '@wizqueue/shared';

export class ColorController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const colors = await ColorModel.findAll();
      res.json({ success: true, data: colors });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(createColorSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const color = await ColorModel.create(parsed.data);
      res.status(201).json({ success: true, data: color, message: 'Color created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateColorSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const color = await ColorModel.update(id, parsed.data);
      if (!color) { res.status(404).json({ success: false, error: 'Color not found' }); return; }
      res.json({ success: true, data: color, message: 'Color updated' });
    } catch (error) { next(error); }
  }

  async addSpool(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const color = await ColorModel.addSpool(id);
      if (!color) { res.status(404).json({ success: false, error: 'Color not found' }); return; }
      res.json({ success: true, data: color, message: `Added spool to inventory (now ${color.inventoryGrams.toFixed(0)}g)` });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const deleted = await ColorModel.delete(id);
      if (!deleted) { res.status(404).json({ success: false, error: 'Color not found' }); return; }
      res.json({ success: true, message: 'Color deleted' });
    } catch (error) { next(error); }
  }

  async setLineItemColors(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(setItemColorsSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const result = await LineItemColorModel.setColors(itemId, parsed.data.colors);
      res.json({ success: true, data: result, message: 'Colors updated' });
    } catch (error) { next(error); }
  }

  // BuildPlan #6 Phase 3: setQueueItemColors removed alongside the queue subsystem.

  // Bug #66 — GET /api/colors/duplicates
  // Returns groups of color rows sharing the same (UPPER(hex), material).
  // Each row carries per-color usage counts so the admin UI can show how
  // many invoice + product references depend on each candidate keeper.
  async duplicates(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const groups = await findDuplicates();
      res.json({ success: true, data: groups });
    } catch (error) { next(error); }
  }

  // Bug #66 — POST /api/colors/merge
  // Body: { keepId, mergeIds[] }. Repoints line_item_colors and
  // product_colors (with UNIQUE conflict resolution by weight sum), then
  // deletes the dupe color rows in one transaction. Refuses if any
  // dupe row has bambuddy_id set — see color-dedupe.service.ts for why.
  async merge(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(mergeColorsSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const result = await mergeColors(parsed.data.keepId, parsed.data.mergeIds);
      res.json({
        success: true,
        data: result,
        message: `Merged ${result.merged} duplicate(s) into color ${result.keepId}. Repointed ${result.lineItemColorsRepointed} invoice color(s) and ${result.productColorsRepointed} product slot(s); merged ${result.productColorsMerged} overlapping product slot(s).`,
      });
    } catch (error) { next(error); }
  }

  // BuildPlan #6 Phase 4 — POST /api/colors/sync-from-bambuddy
  // One-shot pull from BamBuddy's filament catalog + spool inventory.
  // Returns a diff summary the admin UI surfaces as a toast. Idempotent;
  // safe to call from a nightly cron.
  async syncFromBambuddy(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const result = await fullSync();
      res.json({
        success: true,
        data: result,
        message: `Catalog: ${result.catalog.added} added, ${result.catalog.updated} updated, ${result.catalog.untouched} unchanged. Inventory: ${result.inventory.colorsUpdated} colors refreshed.`,
      });
    } catch (error) { next(error); }
  }
}

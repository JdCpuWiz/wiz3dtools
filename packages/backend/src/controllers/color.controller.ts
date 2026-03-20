import { Request, Response, NextFunction } from 'express';
import { ColorModel } from '../models/color.model.js';
import { LineItemColorModel, QueueItemColorModel } from '../models/item-color.model.js';
import { InvoiceLineItemModel } from '../models/invoice-line-item.model.js';
import { parseBody, createColorSchema, updateColorSchema, setItemColorsSchema } from '../validation/schemas.js';
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

      // If this line item has been sent to queue, sync colors to the queue item too
      const lineItem = await InvoiceLineItemModel.findById(itemId);
      if (lineItem?.queueItemId) {
        await QueueItemColorModel.setColors(lineItem.queueItemId, parsed.data.colors);
      }

      res.json({ success: true, data: result, message: 'Colors updated' });
    } catch (error) { next(error); }
  }

  async setQueueItemColors(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(setItemColorsSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const result = await QueueItemColorModel.setColors(id, parsed.data.colors);
      res.json({ success: true, data: result, message: 'Colors updated' });
    } catch (error) { next(error); }
  }
}

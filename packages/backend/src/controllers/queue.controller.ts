import { Request, Response, NextFunction } from 'express';
import { QueueService } from '../services/queue.service.js';
import {
  parseBody,
  createQueueItemSchema,
  updateQueueItemSchema,
  batchCreateQueueSchema,
  reorderQueueSchema,
  updateQueueStatusSchema,
} from '../validation/schemas.js';
import type { ApiResponse } from '@wizqueue/shared';

const queueService = new QueueService();

export class QueueController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const items = await queueService.getAllItems();
      res.json({ success: true, data: items });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const item = await queueService.getItemById(id);
      res.json({ success: true, data: item });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(createQueueItemSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const item = await queueService.createItem(parsed.data);
      res.status(201).json({ success: true, data: item, message: 'Queue item created successfully' });
    } catch (error) { next(error); }
  }

  async createBatch(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(batchCreateQueueSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const createdItems = await queueService.createManyItems(parsed.data.items);
      res.status(201).json({
        success: true,
        data: createdItems,
        message: `${createdItems.length} queue items created successfully`,
      });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateQueueItemSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const item = await queueService.updateItem(id, parsed.data);
      res.json({ success: true, data: item, message: 'Queue item updated successfully' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await queueService.deleteItem(id);
      res.json({ success: true, message: 'Queue item deleted successfully' });
    } catch (error) { next(error); }
  }

  async reorder(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const parsed = parseBody(reorderQueueSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      await queueService.reorderItem(parsed.data);
      res.json({ success: true, message: 'Queue reordered successfully' });
    } catch (error) { next(error); }
  }

  async updateStatus(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const parsed = parseBody(updateQueueStatusSchema, req.body);
      if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
      const item = await queueService.updateItemStatus(id, parsed.data.status);
      res.json({ success: true, data: item, message: 'Status updated successfully' });
    } catch (error) { next(error); }
  }
}

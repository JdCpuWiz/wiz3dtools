import { Request, Response, NextFunction } from 'express';
import { QueueService } from '../services/queue.service.js';
import type { ApiResponse } from '@wizqueue/shared';

const queueService = new QueueService();

export class QueueController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const items = await queueService.getAllItems();
      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
        });
      }

      const item = await queueService.getItemById(id);
      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const item = await queueService.createItem(req.body);
      res.status(201).json({
        success: true,
        data: item,
        message: 'Queue item created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async createBatch(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: 'Items must be an array',
        });
      }

      const createdItems = await queueService.createManyItems(items);
      res.status(201).json({
        success: true,
        data: createdItems,
        message: `${createdItems.length} queue items created successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
        });
      }

      const item = await queueService.updateItem(id, req.body);
      res.json({
        success: true,
        data: item,
        message: 'Queue item updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
        });
      }

      await queueService.deleteItem(id);
      res.json({
        success: true,
        message: 'Queue item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { itemId, newPosition } = req.body;

      if (!itemId || newPosition === undefined) {
        return res.status(400).json({
          success: false,
          error: 'itemId and newPosition are required',
        });
      }

      await queueService.reorderItem({ itemId, newPosition });
      res.json({
        success: true,
        message: 'Queue reordered successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required',
        });
      }

      const item = await queueService.updateItemStatus(id, status);
      res.json({
        success: true,
        data: item,
        message: 'Status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

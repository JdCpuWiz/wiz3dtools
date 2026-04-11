import { QueueItemModel } from '../models/queue-item.model.js';
import { QueueItemColorModel } from '../models/item-color.model.js';
import { ColorModel } from '../models/color.model.js';
import type {
  QueueItem,
  CreateQueueItemDto,
  UpdateQueueItemDto,
  ReorderQueueDto,
} from '@wizqueue/shared';

export class QueueService {
  async getAllItems(): Promise<QueueItem[]> {
    return await QueueItemModel.findAll();
  }

  async getItemById(id: number): Promise<QueueItem> {
    const item = await QueueItemModel.findById(id);
    if (!item) {
      throw new Error('Queue item not found');
    }
    return item;
  }

  async createItem(data: CreateQueueItemDto): Promise<QueueItem> {
    return await QueueItemModel.create(data);
  }

  async createManyItems(items: CreateQueueItemDto[]): Promise<QueueItem[]> {
    if (items.length === 0) {
      return [];
    }
    return await QueueItemModel.createMany(items);
  }

  async updateItem(id: number, data: UpdateQueueItemDto): Promise<QueueItem> {
    const updated = await QueueItemModel.update(id, data);
    if (!updated) {
      throw new Error('Queue item not found');
    }
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    const deleted = await QueueItemModel.delete(id);
    if (!deleted) {
      throw new Error('Queue item not found');
    }
  }

  async reorderItem(data: ReorderQueueDto): Promise<void> {
    await QueueItemModel.reorder(data.itemId, data.newPosition);
  }

  async updateItemStatus(id: number, status: string): Promise<QueueItem> {
    // Check current status before updating so we can detect a real transition.
    // If the item is already completed (e.g. Bambu monitor already finished it),
    // skip inventory deduction to prevent double-counting.
    const existing = await QueueItemModel.findById(id);
    const wasAlreadyCompleted = existing?.status === 'completed';

    const item = await this.updateItem(id, { status: status as any });

    // When an item is completed, deduct filament from inventory.
    // Skip for in-house prints — the Bambu monitor already deducted via filament_jobs.
    // Also skip if the item was already completed — avoids double-deduction when Bambu
    // auto-transitioned it and the user clicks complete manually afterwards.
    if (status === 'completed' && !item.isInhouse && !wasAlreadyCompleted) {
      try {
        const colors = await QueueItemColorModel.findByQueueItem(id);
        for (const c of colors) {
          if (c.weightGrams > 0) {
            // Deduct: weight per print × quantity printed
            await ColorModel.deductInventory(c.colorId, c.weightGrams * item.quantity);
          }
        }
      } catch (err) {
        // Swallow — inventory deduction errors should never block status update
        console.error('Inventory deduction error (non-fatal):', err);
      }
    }

    return item;
  }
}

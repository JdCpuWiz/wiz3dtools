import type { ItemColor } from './color';

export type QueueItemStatus = 'pending' | 'printing' | 'completed' | 'cancelled';

export interface QueueItem {
  id: number;
  productName: string;
  sku: string | null;
  details: string | null;
  quantity: number;
  position: number;
  status: QueueItemStatus;
  invoiceId: number | null;
  priority: number;
  notes: string | null;
  printerName: string | null;
  isInhouse: boolean;
  colors: ItemColor[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueueItemDto {
  productName: string;
  sku?: string;
  details?: string;
  quantity: number;
  position?: number;
  status?: QueueItemStatus;
  invoiceId?: number;
  priority?: number;
  notes?: string;
  printerName?: string;
  isInhouse?: boolean;
}

export interface UpdateQueueItemDto {
  productName?: string;
  sku?: string;
  details?: string;
  quantity?: number;
  position?: number;
  status?: QueueItemStatus;
  priority?: number;
  notes?: string;
  printerName?: string;
  isInhouse?: boolean;
}

export interface ReorderQueueDto {
  itemId: number;
  newPosition: number;
}

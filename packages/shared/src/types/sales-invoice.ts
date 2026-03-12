import type { Customer } from './customer';
import type { ItemColor } from './color';

export type SalesInvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface InvoiceLineItem {
  id: number;
  invoiceId: number;
  productId: number | null;
  productName: string;
  sku: string | null;
  details: string | null;
  quantity: number;
  unitPrice: number;
  queueItemId: number | null;
  colors: ItemColor[];
  createdAt: string;
}

export interface SalesInvoice {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  customer: Customer | null;
  status: SalesInvoiceStatus;
  taxRate: number;
  taxExempt: boolean;
  shippingCost: number;
  notes: string | null;
  dueDate: string | null;
  sentAt: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLineItemDto {
  productId?: number;
  productName: string;
  sku?: string;
  details?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSalesInvoiceDto {
  customerId?: number;
  taxRate?: number;
  taxExempt?: boolean;
  shippingCost?: number;
  notes?: string;
  dueDate?: string;
  lineItems?: CreateLineItemDto[];
}

export interface UpdateSalesInvoiceDto {
  customerId?: number | null;
  status?: SalesInvoiceStatus;
  taxRate?: number;
  taxExempt?: boolean;
  shippingCost?: number;
  notes?: string;
  dueDate?: string | null;
  trackingNumber?: string | null;
}

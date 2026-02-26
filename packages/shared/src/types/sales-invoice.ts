import type { Customer } from './customer';

export type SalesInvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface InvoiceLineItem {
  id: number;
  invoiceId: number;
  productId: number | null;
  productName: string;
  details: string | null;
  quantity: number;
  unitPrice: number;
  queueItemId: number | null;
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
  notes: string | null;
  dueDate: string | null;
  sentAt: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLineItemDto {
  productId?: number;
  productName: string;
  details?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSalesInvoiceDto {
  customerId?: number;
  taxRate?: number;
  taxExempt?: boolean;
  notes?: string;
  dueDate?: string;
  lineItems?: CreateLineItemDto[];
}

export interface UpdateSalesInvoiceDto {
  customerId?: number | null;
  status?: SalesInvoiceStatus;
  taxRate?: number;
  taxExempt?: boolean;
  notes?: string;
  dueDate?: string | null;
}

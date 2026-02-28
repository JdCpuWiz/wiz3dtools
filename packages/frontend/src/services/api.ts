import axios from 'axios';
import type {
  QueueItem,
  CreateQueueItemDto,
  UpdateQueueItemDto,
  ReorderQueueDto,
  InvoiceUploadResponse,
  InvoiceProcessingStatus,
  ApiResponse,
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  SalesInvoice,
  CreateSalesInvoiceDto,
  UpdateSalesInvoiceDto,
  InvoiceLineItem,
  CreateLineItemDto,
  Product,
  CreateProductDto,
  UpdateProductDto,
  User,
} from '@wizqueue/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

console.log('API Base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for file uploads
});

// Log all requests for debugging; attach JWT if present
api.interceptors.request.use((config) => {
  console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  const raw = localStorage.getItem('wiz3d_auth');
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // ignore
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Error: ${error.config?.url}`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      if (error.response.status === 401) {
        localStorage.removeItem('wiz3d_auth');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Queue API
export const queueApi = {
  getAll: async (): Promise<QueueItem[]> => {
    const response = await api.get<ApiResponse<QueueItem[]>>('/queue');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<QueueItem> => {
    const response = await api.get<ApiResponse<QueueItem>>(`/queue/${id}`);
    if (!response.data.data) {
      throw new Error('Queue item not found');
    }
    return response.data.data;
  },

  create: async (data: CreateQueueItemDto): Promise<QueueItem> => {
    const response = await api.post<ApiResponse<QueueItem>>('/queue', data);
    if (!response.data.data) {
      throw new Error('Failed to create queue item');
    }
    return response.data.data;
  },

  createBatch: async (items: CreateQueueItemDto[]): Promise<QueueItem[]> => {
    const response = await api.post<ApiResponse<QueueItem[]>>('/queue/batch', { items });
    return response.data.data || [];
  },

  update: async (id: number, data: UpdateQueueItemDto): Promise<QueueItem> => {
    const response = await api.put<ApiResponse<QueueItem>>(`/queue/${id}`, data);
    if (!response.data.data) {
      throw new Error('Failed to update queue item');
    }
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/queue/${id}`);
  },

  reorder: async (data: ReorderQueueDto): Promise<void> => {
    await api.patch('/queue/reorder', data);
  },

  updateStatus: async (id: number, status: string): Promise<QueueItem> => {
    const response = await api.patch<ApiResponse<QueueItem>>(`/queue/${id}/status`, { status });
    if (!response.data.data) {
      throw new Error('Failed to update status');
    }
    return response.data.data;
  },
};

// Upload API
export const uploadApi = {
  uploadInvoice: async (file: File): Promise<InvoiceUploadResponse> => {
    const formData = new FormData();
    formData.append('invoice', file);

    const response = await api.post<ApiResponse<InvoiceUploadResponse>>(
      '/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.data) {
      throw new Error('Failed to upload invoice');
    }
    return response.data.data;
  },

  getInvoiceStatus: async (id: number): Promise<InvoiceProcessingStatus> => {
    const response = await api.get<ApiResponse<InvoiceProcessingStatus>>(`/upload/${id}`);
    if (!response.data.data) {
      throw new Error('Invoice not found');
    }
    return response.data.data;
  },
};

// Customer API
export const customerApi = {
  getAll: async (): Promise<Customer[]> => {
    const response = await api.get<ApiResponse<Customer[]>>('/customers');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Customer> => {
    const response = await api.get<ApiResponse<Customer>>(`/customers/${id}`);
    if (!response.data.data) throw new Error('Customer not found');
    return response.data.data;
  },

  create: async (data: CreateCustomerDto): Promise<Customer> => {
    const response = await api.post<ApiResponse<Customer>>('/customers', data);
    if (!response.data.data) throw new Error('Failed to create customer');
    return response.data.data;
  },

  update: async (id: number, data: UpdateCustomerDto): Promise<Customer> => {
    const response = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update customer');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },
};

// Sales Invoice API
export const salesInvoiceApi = {
  getAll: async (): Promise<SalesInvoice[]> => {
    const response = await api.get<ApiResponse<SalesInvoice[]>>('/sales-invoices');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<SalesInvoice> => {
    const response = await api.get<ApiResponse<SalesInvoice>>(`/sales-invoices/${id}`);
    if (!response.data.data) throw new Error('Invoice not found');
    return response.data.data;
  },

  create: async (data: CreateSalesInvoiceDto): Promise<SalesInvoice> => {
    const response = await api.post<ApiResponse<SalesInvoice>>('/sales-invoices', data);
    if (!response.data.data) throw new Error('Failed to create invoice');
    return response.data.data;
  },

  update: async (id: number, data: UpdateSalesInvoiceDto): Promise<SalesInvoice> => {
    const response = await api.put<ApiResponse<SalesInvoice>>(`/sales-invoices/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update invoice');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/sales-invoices/${id}`);
  },

  addLineItem: async (invoiceId: number, data: CreateLineItemDto): Promise<InvoiceLineItem> => {
    const response = await api.post<ApiResponse<InvoiceLineItem>>(`/sales-invoices/${invoiceId}/line-items`, data);
    if (!response.data.data) throw new Error('Failed to add line item');
    return response.data.data;
  },

  updateLineItem: async (invoiceId: number, itemId: number, data: Partial<CreateLineItemDto>): Promise<InvoiceLineItem> => {
    const response = await api.put<ApiResponse<InvoiceLineItem>>(`/sales-invoices/${invoiceId}/line-items/${itemId}`, data);
    if (!response.data.data) throw new Error('Failed to update line item');
    return response.data.data;
  },

  deleteLineItem: async (invoiceId: number, itemId: number): Promise<void> => {
    await api.delete(`/sales-invoices/${invoiceId}/line-items/${itemId}`);
  },

  sendEmail: async (id: number): Promise<void> => {
    await api.post(`/sales-invoices/${id}/send`);
  },

  sendToQueue: async (id: number, lineItemIds?: number[]): Promise<void> => {
    await api.post(`/sales-invoices/${id}/send-to-queue`, { lineItemIds });
  },

  downloadPdf: (id: number): string => {
    return `${API_BASE_URL}/sales-invoices/${id}/pdf`;
  },
};

// Products API
export const productApi = {
  getAll: async (activeOnly = false): Promise<Product[]> => {
    const response = await api.get<ApiResponse<Product[]>>(`/products${activeOnly ? '?active=true' : ''}`);
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Product> => {
    const response = await api.get<ApiResponse<Product>>(`/products/${id}`);
    if (!response.data.data) throw new Error('Product not found');
    return response.data.data;
  },

  create: async (data: CreateProductDto): Promise<Product> => {
    const response = await api.post<ApiResponse<Product>>('/products', data);
    if (!response.data.data) throw new Error('Failed to create product');
    return response.data.data;
  },

  update: async (id: number, data: UpdateProductDto): Promise<Product> => {
    const response = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update product');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/products/${id}`);
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(message);
    }
  },

  suggestSku: async (name: string, excludeId?: number): Promise<string> => {
    const params = new URLSearchParams({ name });
    if (excludeId) params.set('excludeId', String(excludeId));
    const response = await api.get<ApiResponse<string>>(`/products/suggest-sku?${params.toString()}`);
    return response.data.data || '';
  },
};

// Users API (admin only)
export const userApi = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get<ApiResponse<User[]>>('/users');
    return response.data.data || [];
  },

  create: async (data: { username: string; password: string; email?: string; role?: string }): Promise<User> => {
    const response = await api.post<ApiResponse<User>>('/users', data);
    if (!response.data.data) throw new Error('Failed to create user');
    return response.data.data;
  },

  update: async (id: number, data: { email?: string | null; role?: string }): Promise<User> => {
    const response = await api.put<ApiResponse<User>>(`/users/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update user');
    return response.data.data;
  },

  resetPassword: async (id: number, password: string): Promise<void> => {
    await api.post(`/users/${id}/reset-password`, { password });
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

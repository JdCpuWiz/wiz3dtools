import axios from 'axios';
import type {
  QueueItem,
  CreateQueueItemDto,
  UpdateQueueItemDto,
  ReorderQueueDto,
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
  ProductColor,
  ProductColorDto,
  CreateProductDto,
  UpdateProductDto,
  User,
  Manufacturer,
  CreateManufacturerDto,
  UpdateManufacturerDto,
  Color,
  CreateColorDto,
  UpdateColorDto,
  ItemColor,
  ItemColorDto,
  Printer,
  CreatePrinterDto,
  UpdatePrinterDto,
  FilamentJob,
  PrinterLiveStatus,
} from '@wizqueue/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

console.log('API Base URL:', API_BASE_URL);

// In-memory CSRF token — set by AuthContext after login/me, cleared on logout
let _csrfToken: string | null = null;
export function setCsrfToken(token: string | null) { _csrfToken = token; }

const SAFE_METHODS = new Set(['get', 'head', 'options']);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // send HttpOnly JWT cookie on every request
  timeout: 120000, // 2 minute timeout for file uploads
});

// Log all requests; attach CSRF token for mutating methods
api.interceptors.request.use((config) => {
  console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  const method = (config.method || 'get').toLowerCase();
  if (!SAFE_METHODS.has(method) && _csrfToken) {
    config.headers['X-CSRF-Token'] = _csrfToken;
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
        setCsrfToken(null);
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

  ship: async (id: number): Promise<void> => {
    await api.post(`/sales-invoices/${id}/ship`);
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

  getColors: async (id: number): Promise<ProductColor[]> => {
    const response = await api.get<ApiResponse<ProductColor[]>>(`/products/${id}/colors`);
    return response.data.data || [];
  },

  setColors: async (id: number, colors: ProductColorDto[]): Promise<ProductColor[]> => {
    const response = await api.put<ApiResponse<ProductColor[]>>(`/products/${id}/colors`, { colors });
    return response.data.data || [];
  },

  suggestSku: async (name: string, excludeId?: number): Promise<string> => {
    const params = new URLSearchParams({ name });
    if (excludeId) params.set('excludeId', String(excludeId));
    const response = await api.get<ApiResponse<string>>(`/products/suggest-sku?${params.toString()}`);
    return response.data.data || '';
  },

  copy: async (id: number): Promise<Product> => {
    const response = await api.post<ApiResponse<Product>>(`/products/${id}/copy`);
    if (!response.data.data) throw new Error('Failed to copy product');
    return response.data.data;
  },
};

// Colors API
export const colorApi = {
  getAll: async (): Promise<Color[]> => {
    const response = await api.get<ApiResponse<Color[]>>('/colors');
    return response.data.data || [];
  },

  create: async (data: CreateColorDto): Promise<Color> => {
    const response = await api.post<ApiResponse<Color>>('/colors', data);
    if (!response.data.data) throw new Error('Failed to create color');
    return response.data.data;
  },

  update: async (id: number, data: UpdateColorDto): Promise<Color> => {
    const response = await api.put<ApiResponse<Color>>(`/colors/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update color');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/colors/${id}`);
  },

  setLineItemColors: async (invoiceId: number, itemId: number, colors: ItemColorDto[]): Promise<ItemColor[]> => {
    const response = await api.put<ApiResponse<ItemColor[]>>(
      `/sales-invoices/${invoiceId}/line-items/${itemId}/colors`,
      { colors },
    );
    return response.data.data || [];
  },

  addSpool: async (colorId: number): Promise<Color> => {
    const response = await api.post<ApiResponse<Color>>(`/colors/${colorId}/add-spool`);
    if (!response.data.data) throw new Error('Failed to add spool');
    return response.data.data;
  },

  setQueueItemColors: async (queueItemId: number, colors: ItemColorDto[]): Promise<ItemColor[]> => {
    const response = await api.put<ApiResponse<ItemColor[]>>(
      `/queue/${queueItemId}/colors`,
      { colors },
    );
    return response.data.data || [];
  },
};

// Manufacturer API
export const manufacturerApi = {
  getAll: async (): Promise<Manufacturer[]> => {
    const response = await api.get<ApiResponse<Manufacturer[]>>('/manufacturers');
    return response.data.data || [];
  },

  create: async (data: CreateManufacturerDto): Promise<Manufacturer> => {
    const response = await api.post<ApiResponse<Manufacturer>>('/manufacturers', data);
    if (!response.data.data) throw new Error('Failed to create manufacturer');
    return response.data.data;
  },

  update: async (id: number, data: UpdateManufacturerDto): Promise<Manufacturer> => {
    const response = await api.put<ApiResponse<Manufacturer>>(`/manufacturers/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update manufacturer');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/manufacturers/${id}`);
  },
};

// Printer API
export const printerApi = {
  getAll: async (): Promise<Printer[]> => {
    const response = await api.get<ApiResponse<Printer[]>>('/printers');
    return response.data.data || [];
  },

  create: async (data: CreatePrinterDto): Promise<Printer> => {
    const response = await api.post<ApiResponse<Printer>>('/printers', data);
    if (!response.data.data) throw new Error('Failed to create printer');
    return response.data.data;
  },

  update: async (id: number, data: UpdatePrinterDto): Promise<Printer> => {
    const response = await api.put<ApiResponse<Printer>>(`/printers/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update printer');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/printers/${id}`);
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

// Bambu live status API
export const bambuApi = {
  getLiveStatus: async (): Promise<PrinterLiveStatus[]> => {
    const response = await api.get<ApiResponse<PrinterLiveStatus[]>>('/bambu/live');
    return response.data.data || [];
  },
};

// Filament Jobs API
export const filamentJobApi = {
  getAll: async (status?: string): Promise<{ jobs: FilamentJob[]; pendingCount: number }> => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get<any>(`/filament-jobs${params}`);
    return {
      jobs: response.data.data || [],
      pendingCount: response.data.meta?.pendingCount ?? 0,
    };
  },

  getLastByPrinter: async (printerName: string): Promise<FilamentJob[]> => {
    const response = await api.get<ApiResponse<FilamentJob[]>>(
      `/filament-jobs/last-print?printerName=${encodeURIComponent(printerName)}`,
    );
    return response.data.data ?? [];
  },

  getByQueueItem: async (queueItemId: number): Promise<FilamentJob[]> => {
    const response = await api.get<ApiResponse<FilamentJob[]>>(
      `/filament-jobs/by-queue-item/${queueItemId}`,
    );
    return response.data.data ?? [];
  },

  resolve: async (id: number, colorId: number): Promise<FilamentJob> => {
    const response = await api.put<ApiResponse<FilamentJob>>(`/filament-jobs/${id}/resolve`, { colorId });
    if (!response.data.data) throw new Error('Failed to resolve job');
    return response.data.data;
  },

  skip: async (id: number): Promise<FilamentJob> => {
    const response = await api.put<ApiResponse<FilamentJob>>(`/filament-jobs/${id}/skip`, {});
    if (!response.data.data) throw new Error('Failed to skip job');
    return response.data.data;
  },
};

// Reports API
export const reportsApi = {
  getSalesReport: async (startDate: string, endDate: string) => {
    const response = await api.get<ApiResponse<unknown>>(`/reports/sales?startDate=${startDate}&endDate=${endDate}`);
    return response.data.data;
  },

  downloadSalesReportPdf: async (startDate: string, endDate: string): Promise<void> => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const url = `${base}/reports/sales/pdf?startDate=${startDate}&endDate=${endDate}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to download sales report');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `sales-report-${startDate}-to-${endDate}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  },
};

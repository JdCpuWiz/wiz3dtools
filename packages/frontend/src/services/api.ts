import axios from 'axios';
import type {
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
  ProductImage,
  CreateProductDto,
  UpdateProductDto,
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  User,
  Manufacturer,
  CreateManufacturerDto,
  UpdateManufacturerDto,
  Color,
  CreateColorDto,
  UpdateColorDto,
  ItemColor,
  ItemColorDto,
} from '@wizqueue/shared';

// BuildPlan #6 Phase 3 (2026-06-04): queueApi / printerApi / bambuApi /
// filamentJobApi removed — BamBuddy owns those domains now. The queue,
// printer, and filament-attribution endpoints they hit no longer exist
// in the wiz3dtools backend.

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

console.log('API Base URL:', API_BASE_URL);

let _csrfToken: string | null = null;
export function setCsrfToken(token: string | null) { _csrfToken = token; }

const SAFE_METHODS = new Set(['get', 'head', 'options']);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 120000,
});

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

  uploadImage: async (id: number, file: File): Promise<ProductImage> => {
    const form = new FormData();
    form.append('image', file);
    const response = await api.post<ApiResponse<ProductImage>>(`/products/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!response.data.data) throw new Error('Failed to upload image');
    return response.data.data;
  },

  reorderImages: async (id: number, order: number[]): Promise<void> => {
    await api.patch(`/products/${id}/images/reorder`, { order });
  },

  setPrimaryImage: async (id: number, imageId: number): Promise<void> => {
    await api.patch(`/products/${id}/images/${imageId}/primary`, {});
  },

  deleteImage: async (id: number, imageId: number): Promise<void> => {
    await api.delete(`/products/${id}/images/${imageId}`);
  },
};

// Category API
export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data || [];
  },

  create: async (data: CreateCategoryDto): Promise<Category> => {
    const response = await api.post<ApiResponse<Category>>('/categories', data);
    if (!response.data.data) throw new Error('Failed to create category');
    return response.data.data;
  },

  update: async (id: number, data: UpdateCategoryDto): Promise<Category> => {
    const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update category');
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
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

  // BuildPlan #6 Phase 4 — admin-only pull from BamBuddy's filament catalog
  syncFromBambuddy: async (): Promise<BambuddySyncResult> => {
    const response = await api.post<ApiResponse<BambuddySyncResult>>(`/colors/sync-from-bambuddy`);
    if (!response.data.data) throw new Error('Failed to sync from BamBuddy');
    return response.data.data;
  },
};

export interface BambuddySyncResult {
  catalog: { added: number; updated: number; untouched: number; manufacturerUnmatched: number; total: number };
  inventory: { colorsUpdated: number; totalGrams: number; unmatchedSpools: number };
  finishedAt: string;
}

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

// Wholesale Users API (admin only) — proxied through to wiz3d-prints.
// Source of truth for wholesale credentials lives in wiz3d-prints' DB;
// wiz3dtools is just the admin client. See BuildPlan #11 Phase 1.
export interface WholesaleUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  wiz3dtoolsCustomerId: number | null;
  createdAt: string;
}

export const wholesaleUserApi = {
  getAll: async (): Promise<WholesaleUser[]> => {
    const response = await api.get<ApiResponse<WholesaleUser[]>>('/wholesale-users');
    return response.data.data || [];
  },

  create: async (data: {
    name: string;
    email: string;
    password: string;
    wiz3dtoolsCustomerId?: number | null;
  }): Promise<WholesaleUser> => {
    const response = await api.post<ApiResponse<WholesaleUser>>('/wholesale-users', data);
    if (!response.data.data) throw new Error('Failed to create wholesale user');
    return response.data.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      active?: boolean;
      wiz3dtoolsCustomerId?: number | null;
    },
  ): Promise<WholesaleUser> => {
    const response = await api.patch<ApiResponse<WholesaleUser>>(`/wholesale-users/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update wholesale user');
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/wholesale-users/${id}`);
  },
};

// Showcase Portfolio API (admin only) — proxied through to wiz3d-prints.
// Source of truth lives in wiz3d-prints' DB (PortfolioItem). See
// BuildPlan #11 Phase 3.
export interface ShowcasePortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  material: string;
  dimensions: string | null;
  printTime: string | null;
  images: string[];
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export const showcasePortfolioApi = {
  getAll: async (): Promise<ShowcasePortfolioItem[]> => {
    const response = await api.get<ApiResponse<ShowcasePortfolioItem[]>>('/showcase-portfolio');
    return response.data.data || [];
  },

  create: async (data: Partial<ShowcasePortfolioItem>): Promise<ShowcasePortfolioItem> => {
    const response = await api.post<ApiResponse<ShowcasePortfolioItem>>('/showcase-portfolio', data);
    if (!response.data.data) throw new Error('Failed to create portfolio item');
    return response.data.data;
  },

  update: async (id: string, data: Partial<ShowcasePortfolioItem>): Promise<ShowcasePortfolioItem> => {
    const response = await api.put<ApiResponse<ShowcasePortfolioItem>>(`/showcase-portfolio/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update portfolio item');
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/showcase-portfolio/${id}`);
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

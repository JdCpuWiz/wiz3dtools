import axios from 'axios';
import type {
  QueueItem,
  CreateQueueItemDto,
  UpdateQueueItemDto,
  ReorderQueueDto,
  InvoiceUploadResponse,
  InvoiceProcessingStatus,
  ApiResponse,
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

// Log all requests for debugging
api.interceptors.request.use((config) => {
  console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
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

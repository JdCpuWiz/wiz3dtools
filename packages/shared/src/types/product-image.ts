export interface ProductImageMask {
  id: number;
  imageId: number;
  /** Matches product_colors.sortOrder on the same product (recipe slot). */
  slotIndex: number;
  url: string;
  source: 'AUTO_REMBG' | 'AUTO_REMOVEBG' | 'MANUAL_UPLOAD';
  createdAt: string;
}

/** BP17 Phase 3 — status of an in-process bulk mask-generation run. */
export interface BulkMaskJob {
  id: string;
  status: 'running' | 'done';
  total: number;
  completed: number;
  failed: { imageId: number; productName: string; error: string }[];
  startedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  /** Present on single-product (admin) responses; absent on list responses. */
  masks?: ProductImageMask[];
}

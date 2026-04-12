import type { Color } from './color';
import type { Category } from './category';
import type { ProductImage } from './product-image';

export type { Category, ProductImage };

export interface ProductColor {
  id: number;
  productId: number;
  colorId: number;
  color: Color;
  weightGrams: number;
  sortOrder: number;
}

export interface ProductColorDto {
  colorId: number;
  weightGrams: number;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  unitPrice: number;
  unitsSold: number;
  active: boolean;
  totalWeightGrams: number;
  colors: ProductColor[];
  // Store fields
  publishedToStore: boolean;
  categoryId: number | null;
  category: Category | null;
  storeTitle: string | null;
  storeDescription: string | null;
  wholesalePrice: number;
  retailPrice: number;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  sku?: string;
  unitPrice: number;
  active?: boolean;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  sku?: string;
  unitPrice?: number;
  active?: boolean;
  publishedToStore?: boolean;
  categoryId?: number | null;
  storeTitle?: string | null;
  storeDescription?: string | null;
  wholesalePrice?: number;
  retailPrice?: number;
}

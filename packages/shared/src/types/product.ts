export interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  unitPrice: number;
  unitsSold: number;
  active: boolean;
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
}

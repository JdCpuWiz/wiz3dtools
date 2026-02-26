import { ProductModel } from '../models/product.model.js';
import type { Product, CreateProductDto, UpdateProductDto } from '@wizqueue/shared';

export class ProductService {
  async getAll(activeOnly = false): Promise<Product[]> {
    return ProductModel.findAll(activeOnly);
  }

  async getById(id: number): Promise<Product> {
    const product = await ProductModel.findById(id);
    if (!product) throw new Error('Product not found');
    return product;
  }

  async create(data: CreateProductDto): Promise<Product> {
    return ProductModel.create(data);
  }

  async update(id: number, data: UpdateProductDto): Promise<Product> {
    const product = await ProductModel.update(id, data);
    if (!product) throw new Error('Product not found');
    return product;
  }

  async delete(id: number): Promise<void> {
    const deleted = await ProductModel.delete(id);
    if (!deleted) throw new Error('Product not found');
  }

  async suggestSku(name: string, excludeId?: number): Promise<string> {
    return ProductModel.suggestSku(name, excludeId);
  }
}

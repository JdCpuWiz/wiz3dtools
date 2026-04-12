import { ProductModel } from '../models/product.model.js';
import { ProductColorModel } from '../models/product-color.model.js';
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

  async copy(id: number): Promise<Product> {
    const original = await ProductModel.findById(id);
    if (!original) throw new Error('Product not found');

    const copyName = `Copy of ${original.name}`;
    const newSku = await ProductModel.suggestSku(copyName);

    const copy = await ProductModel.create({
      name: copyName,
      description: original.description ?? undefined,
      sku: newSku,
      unitPrice: original.unitPrice,
      active: false,
    });

    if (original.colors.length > 0) {
      await ProductColorModel.setColors(
        copy.id,
        original.colors.map((c) => ({
          colorId: c.colorId,
          weightGrams: c.weightGrams,
          sortOrder: c.sortOrder,
        })),
      );
      return (await ProductModel.findById(copy.id))!;
    }

    return copy;
  }

  async suggestSku(name: string, excludeId?: number): Promise<string> {
    return ProductModel.suggestSku(name, excludeId);
  }
}

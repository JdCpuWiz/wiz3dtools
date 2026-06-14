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
    // Wholesale-storefront invariant: a product visible to wholesale buyers
    // (published_to_store=TRUE AND active=TRUE) MUST have ≥1 product_colors
    // recipe slot. Without one, StoreService.createOrder rejects orders for
    // it and the storefront filters it out — net effect was a published
    // product that customers never see, with no warning. Enforce here when
    // a request would push the product INTO the visible state.
    if (data.publishedToStore === true || data.active === true) {
      const current = await ProductModel.findById(id);
      if (!current) throw new Error('Product not found');
      const wouldBePublished = data.publishedToStore ?? current.publishedToStore;
      const wouldBeActive = data.active ?? current.active;
      if (wouldBePublished && wouldBeActive) {
        const recipe = await ProductColorModel.findByProduct(id);
        if (recipe.length === 0) {
          throw Object.assign(
            new Error(
              'Cannot publish this product to the wholesale store without at least one recipe slot. Add a color to the recipe first, or uncheck "Published to store".',
            ),
            { statusCode: 400 },
          );
        }
      }
    }

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
      wholesalePrice: original.wholesalePrice,
      retailPrice: original.retailPrice,
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

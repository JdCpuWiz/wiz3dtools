import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../models/product.model.js', () => ({
  ProductModel: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../../models/product-color.model.js', () => ({
  ProductColorModel: {
    findByProduct: vi.fn(),
  },
}));

import { ProductService } from '../product.service.js';
import { ProductModel } from '../../models/product.model.js';
import { ProductColorModel } from '../../models/product-color.model.js';

const service = new ProductService();

// Bare-minimum product fixture — only the fields the invariant check reads.
function fakeProduct(overrides: Partial<{ id: number; publishedToStore: boolean; active: boolean }> = {}) {
  return {
    id: 1, name: 'p', publishedToStore: false, active: true,
    ...overrides,
  } as never;
}

describe('ProductService.update — wholesale recipe invariant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects flipping publishedToStore=true on a product with no recipe slots', async () => {
    vi.mocked(ProductModel.findById).mockResolvedValue(fakeProduct({ publishedToStore: false, active: true }));
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValue([]);

    await expect(service.update(1, { publishedToStore: true })).rejects.toMatchObject({
      message: /Cannot publish this product to the wholesale store without at least one recipe slot/,
      statusCode: 400,
    });
    expect(ProductModel.update).not.toHaveBeenCalled();
  });

  it('allows publishedToStore=true when the recipe has ≥1 slot', async () => {
    vi.mocked(ProductModel.findById).mockResolvedValue(fakeProduct({ publishedToStore: false, active: true }));
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValue([
      { id: 1, productId: 1, colorId: 10, weightGrams: 30, sortOrder: 0, color: {} as never },
    ]);
    vi.mocked(ProductModel.update).mockResolvedValue(fakeProduct({ publishedToStore: true, active: true }));

    await expect(service.update(1, { publishedToStore: true })).resolves.toMatchObject({
      publishedToStore: true,
    });
    expect(ProductModel.update).toHaveBeenCalledOnce();
  });

  it('does not check the recipe when the update does not set publishedToStore or active', async () => {
    vi.mocked(ProductModel.update).mockResolvedValue(fakeProduct());

    await service.update(1, { name: 'rename only' });

    // Invariant short-circuit: neither field is in the update, so no findById/findByProduct call.
    expect(ProductModel.findById).not.toHaveBeenCalled();
    expect(ProductColorModel.findByProduct).not.toHaveBeenCalled();
    expect(ProductModel.update).toHaveBeenCalledOnce();
  });

  it('rejects when reactivating (active=true) a published recipe-less product', async () => {
    // Edge case: product was already publishedToStore=true but active=false (so currently invisible).
    // An update flipping active=true would now make it visible — invariant must fire.
    vi.mocked(ProductModel.findById).mockResolvedValue(fakeProduct({ publishedToStore: true, active: false }));
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValue([]);

    await expect(service.update(1, { active: true })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('allows update with publishedToStore=true when product currently has active=false and not transitioning active', async () => {
    // Product is currently published+inactive (effectively hidden). Updating publishedToStore=true
    // when active stays false → still hidden, recipe-check should NOT block.
    vi.mocked(ProductModel.findById).mockResolvedValue(fakeProduct({ publishedToStore: false, active: false }));
    vi.mocked(ProductModel.update).mockResolvedValue(fakeProduct({ publishedToStore: true, active: false }));

    await service.update(1, { publishedToStore: true });

    // active stayed false → wouldBeActive is false → no recipe check
    expect(ProductColorModel.findByProduct).not.toHaveBeenCalled();
    expect(ProductModel.update).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the model + pool layers BEFORE importing StoreService. vi.mock is
// hoisted by vitest so this runs before the import below.
vi.mock('../../config/database.js', () => ({
  pool: { query: vi.fn() },
}));
vi.mock('../../models/product-color.model.js', () => ({
  ProductColorModel: {
    findByProduct: vi.fn(),
    findByProductIds: vi.fn(),
  },
}));
vi.mock('../../models/sales-invoice.model.js', () => ({
  SalesInvoiceModel: {
    create: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock('../../models/invoice-line-item.model.js', () => ({
  InvoiceLineItemModel: { create: vi.fn() },
}));
vi.mock('../../models/item-color.model.js', () => ({
  LineItemColorModel: { setColors: vi.fn() },
  QueueItemColorModel: {},
}));
vi.mock('../../models/color.model.js', () => ({
  ColorModel: { findAll: vi.fn() },
}));

import { StoreService } from '../store.service.js';
import { pool } from '../../config/database.js';
import { ProductColorModel } from '../../models/product-color.model.js';

const service = new StoreService();

// Helper to seed pool.query for the product lookup at line 123.
function mockProductFound(name = 'Test Product', sku: string | null = 'T-001') {
  vi.mocked(pool.query).mockResolvedValueOnce({
    rows: [{ id: 1, name, sku }],
    rowCount: 1,
  } as never);
}

function mockProductNotFound() {
  vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
}

const baseOrder = {
  customerId: 42,
  lineItems: [{ productId: 1, productName: 'Test', quantity: 1, unitPrice: 5 }],
};

describe('StoreService.createOrder validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the product is not published or not active', async () => {
    mockProductNotFound();
    await expect(service.createOrder(baseOrder)).rejects.toMatchObject({
      message: /Product 1 is not available in the store/,
      statusCode: 400,
    });
  });

  it('rejects a product with zero recipe slots', async () => {
    mockProductFound('Recipe-less SKU');
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValueOnce([]);

    await expect(service.createOrder(baseOrder)).rejects.toMatchObject({
      message: /has no color recipe configured/,
      statusCode: 400,
    });
  });

  it('rejects a colors[] override whose length does not match the recipe', async () => {
    mockProductFound();
    // Recipe has 2 slots, client sent 1 override
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValueOnce([
      { id: 1, productId: 1, colorId: 10, weightGrams: 30, sortOrder: 0, color: {} as never },
      { id: 2, productId: 1, colorId: 11, weightGrams: 5, sortOrder: 1, color: {} as never },
    ]);

    const order = {
      customerId: 42,
      lineItems: [{
        productId: 1, productName: 'Test', quantity: 1, unitPrice: 5,
        colors: [{ colorId: 10, isPrimary: true, sortOrder: 0, weightGrams: 30, note: null }],
      }],
    };

    await expect(service.createOrder(order)).rejects.toMatchObject({
      message: /must have 2 slot\(s\), got 1/,
      statusCode: 400,
    });
  });

  it('rejects a colors[] override referencing an inactive color', async () => {
    mockProductFound();
    vi.mocked(ProductColorModel.findByProduct).mockResolvedValueOnce([
      { id: 1, productId: 1, colorId: 10, weightGrams: 30, sortOrder: 0, color: {} as never },
    ]);
    // Active-color lookup returns empty — colorId 99 is not active
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const order = {
      customerId: 42,
      lineItems: [{
        productId: 1, productName: 'Test', quantity: 1, unitPrice: 5,
        colors: [{ colorId: 99, isPrimary: true, sortOrder: 0, weightGrams: 30, note: null }],
      }],
    };

    await expect(service.createOrder(order)).rejects.toMatchObject({
      message: /Color 99 is not active or does not exist/,
      statusCode: 400,
    });
  });
});

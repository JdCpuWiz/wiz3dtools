import { z, ZodSchema, ZodTypeAny } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseBody<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: messages };
  }
  return { ok: true, data: result.data };
}

// Accepts undefined, null, or a value — transforms null → undefined so output
// type is T | undefined (matching DTO types that use optional() without nullable())
function nullish<T extends ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === null ? undefined : v), schema.optional());
}

// Treats empty string OR null as absent (preserves existing customer email behaviour)
const optionalEmail = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().email('Invalid email format').optional(),
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  email: optionalEmail,
  role: z.enum(['admin', 'user']).optional(),
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(200),
  businessName: nullish(z.string().max(200)),
  email: optionalEmail,
  phone: nullish(z.string().max(50)),
  addressLine1: nullish(z.string().max(200)),
  addressLine2: nullish(z.string().max(200)),
  city: nullish(z.string().max(100)),
  stateProvince: nullish(z.string().max(100)),
  postalCode: nullish(z.string().max(20)),
  country: z.string().max(100).optional(),
  notes: nullish(z.string().max(2000)),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  description: nullish(z.string().max(2000)),
  sku: nullish(z.string().max(50)),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  active: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const createQueueItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required').max(200),
  sku: nullish(z.string().max(50)),
  details: nullish(z.string().max(2000)),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  position: z.number().int().min(0).optional(),
  status: z.enum(['pending', 'printing', 'completed', 'cancelled']).optional(),
  invoiceId: nullish(z.number().int().positive()),
  priority: z.number().int().optional(),
  notes: nullish(z.string().max(2000)),
});

export const updateQueueItemSchema = createQueueItemSchema.partial();

export const batchCreateQueueSchema = z.object({
  items: z.array(createQueueItemSchema).min(1, 'Items array must not be empty'),
});

export const reorderQueueSchema = z.object({
  itemId: z.number().int().positive('itemId must be a positive integer'),
  newPosition: z.number().int().min(0, 'newPosition must be a non-negative integer'),
});

export const updateQueueStatusSchema = z.object({
  status: z.enum(['pending', 'printing', 'completed', 'cancelled']),
});

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const createColorSchema = z.object({
  name: z.string().min(1, 'Color name is required').max(100),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color must be in format #RRGGBB'),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  manufacturerId: nullish(z.number().int().positive()),
  inventoryGrams: z.number().min(0).optional(),
});

export const updateColorSchema = createColorSchema.partial().extend({
  inventoryGrams: z.number().min(0).optional(),
});

const itemColorEntrySchema = z.object({
  colorId: z.number().int().positive('colorId must be a positive integer'),
  isPrimary: z.boolean(),
  note: nullish(z.string().max(200)),
  sortOrder: z.number().int().min(0),
  weightGrams: z.number().min(0).optional().default(0),
});

export const setItemColorsSchema = z.object({
  colors: z.array(itemColorEntrySchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// Product Colors
// ---------------------------------------------------------------------------

const productColorEntrySchema = z.object({
  colorId: z.number().int().positive('colorId must be a positive integer'),
  weightGrams: z.number().min(0, 'Weight must be non-negative'),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const setProductColorsSchema = z.object({
  colors: z.array(productColorEntrySchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// Manufacturers
// ---------------------------------------------------------------------------

export const createManufacturerSchema = z.object({
  name: z.string().min(1, 'Manufacturer name is required').max(100),
  emptySpoolWeightG: z.number().min(0, 'Empty spool weight must be non-negative'),
  fullSpoolNetWeightG: z.number().min(0, 'Full spool net weight must be non-negative'),
  lowThresholdG: z.number().min(0).optional(),
  criticalThresholdG: z.number().min(0).optional(),
});

export const updateManufacturerSchema = createManufacturerSchema.partial();

// ---------------------------------------------------------------------------
// Sales Invoices
// ---------------------------------------------------------------------------

const lineItemBodySchema = z.object({
  productId: nullish(z.number().int().positive()),
  productName: z.string().min(1, 'Product name is required').max(200),
  sku: nullish(z.string().max(50)),
  details: nullish(z.string().max(2000)),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
});

export const createInvoiceSchema = z.object({
  customerId: nullish(z.number().int().positive()),
  taxRate: z.number().min(0, 'Tax rate must be non-negative').max(1, 'Tax rate must be ≤ 1').optional(),
  taxExempt: z.boolean().optional(),
  shippingCost: z.number().min(0, 'Shipping cost must be non-negative').optional(),
  notes: nullish(z.string().max(5000)),
  dueDate: nullish(z.string()),
  lineItems: z.array(lineItemBodySchema).optional(),
});

export const updateInvoiceSchema = z.object({
  customerId: nullish(z.number().int().positive()),
  status: z.enum(['draft', 'sent', 'paid', 'cancelled']).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  taxExempt: z.boolean().optional(),
  shippingCost: z.number().min(0).optional(),
  notes: nullish(z.string().max(5000)),
  dueDate: nullish(z.string()),
  carrier: nullish(z.string().max(50)),
  trackingNumber: nullish(z.string().max(200)),
});

export const addLineItemSchema = lineItemBodySchema;
export const updateLineItemSchema = lineItemBodySchema.partial();

export const sendToQueueSchema = z.object({
  lineItemIds: z.array(z.number().int().positive()).optional(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  email: optionalEmail,
  role: z.enum(['admin', 'user']).optional(),
});

export const updateUserSchema = z.object({
  email: optionalEmail,
  role: z.enum(['admin', 'user']).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

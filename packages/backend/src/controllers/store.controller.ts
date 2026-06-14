import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { StoreService, CreateStoreOrderDto } from '../services/store.service.js';
import { CustomerModel } from '../models/customer.model.js';
import { pool } from '../config/database.js';
import { writeAuditLog } from '../models/audit-log.model.js';
import { signStoreCustomerToken } from '../services/auth.service.js';

// Bug #60 F1: store routes had no audit trail — invoices and customers
// could be created via the store API with no record of who/where. Every
// mutation now writes an audit_logs row tagged actor='store-api' with the
// source IP appended so we can pivot off a single attacker without
// pulling Traefik logs. Reads remain unlogged (high volume, low risk).
const STORE_ACTOR = 'store-api';

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

const service = new StoreService();

export class StoreController {
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allowed = ['businessName', 'contactName', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country'] as const;
      type AllowedKey = typeof allowed[number];
      const data: Partial<Record<AllowedKey, string>> = {};
      for (const key of allowed) {
        const value = req.body?.[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          data[key] = value.trim();
        }
      }

      if (!data.email) {
        res.status(400).json({ success: false, error: 'email is required' });
        return;
      }
      if (!data.contactName) {
        res.status(400).json({ success: false, error: 'contactName is required' });
        return;
      }

      const existing = await pool.query(
        `SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [data.email],
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, error: 'A customer with that email already exists' });
        return;
      }

      const customer = await CustomerModel.create({
        contactName: data.contactName,
        email: data.email,
        businessName: data.businessName,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        stateProvince: data.stateProvince,
        postalCode: data.postalCode,
        country: data.country,
      });
      await writeAuditLog(STORE_ACTOR, 'store.customer.create', `customer:${customer.id}`, `ip=${clientIp(req)} email=${data.email}`);
      res.status(201).json({ success: true, data: customer });
    } catch (error) { next(error); }
  }

  async getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid customer id' });
        return;
      }
      const customer = await CustomerModel.findById(id);
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
      res.json({ success: true, data: customer });
    } catch (error) { next(error); }
  }

  // Change #150 — STORE_API_KEY-only path for wiz3d-prints to keep
  // password_hash + email on the customers row in lockstep with its own
  // User table. NOT gated by per-customer token because the customer is
  // proving identity via the password they're setting — using a token
  // would be circular for new accounts (no token exists yet) and
  // ergonomically broken for password recovery flows.
  async updateCredential(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid customer id' });
        return;
      }
      const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

      const updates: string[] = [];
      const values: unknown[] = [];
      const changedFields: string[] = [];
      let i = 1;

      if (email !== undefined) {
        if (typeof email !== 'string' || email.trim().length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          res.status(400).json({ success: false, error: 'email must be a valid email string' });
          return;
        }
        updates.push(`email = $${i++}`);
        values.push(email.trim());
        changedFields.push('email');
      }

      if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 8) {
          res.status(400).json({ success: false, error: 'password must be at least 8 characters' });
          return;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${i++}`);
        values.push(passwordHash);
        changedFields.push('password');
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, error: 'No credential fields provided (email or password)' });
        return;
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE customers SET ${updates.join(', ')} WHERE id = $${i} RETURNING id`,
        values,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      await writeAuditLog(
        STORE_ACTOR,
        'store.customer.credential-update',
        `customer:${id}`,
        `ip=${clientIp(req)} fields=${changedFields.join(',')}`,
      );
      res.json({ success: true, data: { id, updated: changedFields } });
    } catch (error) { next(error); }
  }

  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid customer id' });
        return;
      }
      const allowed = ['businessName', 'contactName', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country'] as const;
      type AllowedKey = typeof allowed[number];
      const data: Partial<Record<AllowedKey, string>> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }
      const customer = await CustomerModel.update(id, data);
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
      await writeAuditLog(STORE_ACTOR, 'store.customer.update', `customer:${id}`, `ip=${clientIp(req)} fields=${Object.keys(data).join(',')}`);
      res.json({ success: true, data: customer });
    } catch (error) { next(error); }
  }

  // Change #148 F7: mint a short-lived per-customer token that scopes
  // subsequent /api/store/* calls to a specific customerId. Caller
  // (wiz3d-prints) proves customer identity with the email + password
  // they just verified during consumer login. Customers without a
  // password_hash (wholesale-only legacy rows) get 403 — they need to
  // set a consumer password first.
  async issueCustomerToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
      if (typeof email !== 'string' || email.trim().length === 0) {
        res.status(400).json({ success: false, error: 'email is required' });
        return;
      }
      if (typeof password !== 'string' || password.length === 0) {
        res.status(400).json({ success: false, error: 'password is required' });
        return;
      }
      const row = await pool.query(
        `SELECT id, password_hash AS "passwordHash" FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email.trim()],
      );
      const customer = row.rows[0] as { id: number; passwordHash: string | null } | undefined;
      // Generic error in both branches — don't leak whether the email exists.
      if (!customer || !customer.passwordHash) {
        await writeAuditLog(STORE_ACTOR, 'store.token.issue-denied', `email:${email.trim()}`, `ip=${clientIp(req)} reason=no-credential`);
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }
      const ok = await bcrypt.compare(password, customer.passwordHash);
      if (!ok) {
        await writeAuditLog(STORE_ACTOR, 'store.token.issue-denied', `customer:${customer.id}`, `ip=${clientIp(req)} reason=bad-password`);
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }
      const { token, expiresAt } = signStoreCustomerToken(customer.id);
      await writeAuditLog(STORE_ACTOR, 'store.token.issued', `customer:${customer.id}`, `ip=${clientIp(req)}`);
      res.json({ success: true, data: { token, expiresAt, customerId: customer.id } });
    } catch (error) { next(error); }
  }

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const audience = (req.query.audience as string) === 'wholesale' ? 'wholesale' : 'webstore';
      const products = await service.getProducts(audience);
      res.json({ success: true, data: products });
    } catch (error) { next(error); }
  }

  async getColors(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const colors = await service.getActiveColors();
      res.json({ success: true, data: colors });
    } catch (error) { next(error); }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId, notes, lineItems, taxExempt, taxRate } = req.body as CreateStoreOrderDto;

      if (!customerId || !Number.isInteger(customerId)) {
        res.status(400).json({ success: false, error: 'customerId is required' });
        return;
      }
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(400).json({ success: false, error: 'lineItems must be a non-empty array' });
        return;
      }
      if (taxExempt !== undefined && typeof taxExempt !== 'boolean') {
        res.status(400).json({ success: false, error: 'taxExempt must be a boolean' });
        return;
      }
      if (taxRate !== undefined && (typeof taxRate !== 'number' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1)) {
        res.status(400).json({ success: false, error: 'taxRate must be a number between 0 and 1' });
        return;
      }
      for (const item of lineItems) {
        if (!item.productId || !Number.isInteger(item.productId)) {
          res.status(400).json({ success: false, error: 'Each line item must have a valid productId' });
          return;
        }
        if (!item.quantity || item.quantity < 1) {
          res.status(400).json({ success: false, error: 'Each line item must have quantity >= 1' });
          return;
        }
        if (item.unitPrice === undefined || item.unitPrice < 0) {
          res.status(400).json({ success: false, error: 'Each line item must have a valid unitPrice' });
          return;
        }
        if (item.colors !== undefined) {
          if (!Array.isArray(item.colors)) {
            res.status(400).json({ success: false, error: 'colors must be an array' });
            return;
          }
          for (const c of item.colors) {
            if (!c || typeof c !== 'object' || !Number.isInteger(c.colorId) || c.colorId < 1) {
              res.status(400).json({ success: false, error: 'Each color override must have a positive integer colorId' });
              return;
            }
          }
        }
      }

      const audience = (req.query.audience as string) === 'wholesale' ? 'wholesale' : 'webstore';
      const invoice = await service.createOrder({ customerId, notes, lineItems, taxExempt, taxRate }, audience);
      const itemsTotal = lineItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      await writeAuditLog(
        STORE_ACTOR,
        'store.invoice.create',
        `invoice:${invoice.invoiceNumber}`,
        `ip=${clientIp(req)} customerId=${customerId} items=${lineItems.length} itemsSubtotal=${itemsTotal.toFixed(2)}`,
      );
      res.status(201).json({ success: true, data: invoice });
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Change #148 F7: prefer the token's customerId when present —
      // can't be tricked into listing someone else's orders by tampering
      // the query param. Falls back to query when no token (legacy /
      // flag-off path).
      const tokenCustomerId = req.storeCustomer?.id;
      const queryCustomerId = parseInt(req.query.customerId as string);
      const customerId = tokenCustomerId ?? queryCustomerId;
      if (!customerId || isNaN(customerId)) {
        res.status(400).json({ success: false, error: 'customerId query param is required' });
        return;
      }
      const orders = await service.getOrdersByCustomer(customerId);
      res.json({ success: true, data: orders });
    } catch (error) { next(error); }
  }

  async markPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid order id' });
        return;
      }
      const { customerId, paymentProvider, paymentRef } = req.body ?? {};
      if (!Number.isInteger(customerId) || customerId < 1) {
        res.status(400).json({ success: false, error: 'customerId is required' });
        return;
      }
      if (typeof paymentProvider !== 'string' || paymentProvider.trim().length === 0) {
        res.status(400).json({ success: false, error: 'paymentProvider is required' });
        return;
      }
      if (typeof paymentRef !== 'string' || paymentRef.trim().length === 0) {
        res.status(400).json({ success: false, error: 'paymentRef is required' });
        return;
      }

      const result = await service.markOrderPaid(id, customerId, paymentProvider.trim(), paymentRef.trim());
      if (!result) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      if (result.transitioned) {
        await writeAuditLog(
          STORE_ACTOR,
          'store.invoice.mark-paid',
          `invoice:${result.invoice.invoiceNumber}`,
          `ip=${clientIp(req)} customerId=${customerId} provider=${paymentProvider.trim()} ref=${paymentRef.trim()}`,
        );
      }
      res.json({ success: true, data: result.invoice, transitioned: result.transitioned });
    } catch (error) { next(error); }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid order id' });
        return;
      }
      // Change #148 F7: token customerId wins; query is fallback. Stops
      // ?customerId= tampering from reaching another customer's order.
      const tokenCustomerId = req.storeCustomer?.id;
      const queryCustomerId = parseInt(req.query.customerId as string);
      const customerId = tokenCustomerId ?? queryCustomerId;
      if (!customerId || isNaN(customerId)) {
        res.status(400).json({ success: false, error: 'customerId query param is required' });
        return;
      }
      const order = await service.getOrderById(id, customerId);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  }
}

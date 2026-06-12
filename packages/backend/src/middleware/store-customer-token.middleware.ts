import { Request, Response, NextFunction } from 'express';
import { verifyStoreCustomerToken } from '../services/auth.service.js';
import { writeAuditLog } from '../models/audit-log.model.js';

// Change #148 F7 — per-customer scope on the store API.
//
// requireStoreApiKey already verified the calling service is wiz3d-prints
// (or any STORE_API_KEY holder). This middleware adds a SECOND check:
// the request is also scoped to a specific customer, proven by an
// HMAC-signed token issued during consumer login.
//
// Layer them on per-customer endpoints (orders, customer detail/update,
// markPaid). Endpoints that operate without a customer (GET /products,
// POST /customers signup) don't use this middleware.
//
// Soft-rollout gate: when ENABLE_STORE_CUSTOMER_TOKEN is not exactly
// 'true', the middleware is a no-op pass-through — wiz3d-prints can
// migrate at its own pace without 401s. Once both sides are on the new
// shape, flip the flag to enforce.

const HEADER_NAME = 'x-customer-token';

declare global {
  namespace Express {
    interface Request {
      storeCustomer?: { id: number };
    }
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

export function requireStoreCustomerToken(req: Request, res: Response, next: NextFunction): void {
  const enforced = process.env.ENABLE_STORE_CUSTOMER_TOKEN === 'true';
  const raw = req.headers[HEADER_NAME];

  // Best-effort verification even when not enforced — gives us audit
  // breadcrumbs during the rollout window.
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const payload = verifyStoreCustomerToken(raw);
      req.storeCustomer = { id: payload.customerId };
      return next();
    } catch (err: any) {
      if (enforced) {
        void writeAuditLog(
          'store-api',
          'store.token.invalid',
          undefined,
          `ip=${clientIp(req)} reason=${err?.message ?? 'unknown'}`,
        );
        res.status(401).json({ success: false, error: err?.message ?? 'Invalid store-customer token' });
        return;
      }
      // Not enforced — log + fall through.
      void writeAuditLog(
        'store-api',
        'store.token.invalid.shadow',
        undefined,
        `ip=${clientIp(req)} reason=${err?.message ?? 'unknown'}`,
      );
      return next();
    }
  }

  // No token header at all
  if (enforced) {
    void writeAuditLog(
      'store-api',
      'store.token.missing',
      undefined,
      `ip=${clientIp(req)} path=${req.path}`,
    );
    res.status(401).json({ success: false, error: 'X-Customer-Token header required' });
    return;
  }
  next();
}

// Body-customerId vs token-customerId match. Use after requireStoreCustomerToken
// on routes that take customerId in the body. Defense-in-depth: even when the
// token verified, the body's customerId can't refer to someone else's account.
export function assertBodyCustomerMatchesToken(req: Request, res: Response, next: NextFunction): void {
  const enforced = process.env.ENABLE_STORE_CUSTOMER_TOKEN === 'true';
  const bodyCustomerId = req.body?.customerId;
  if (!enforced || !req.storeCustomer) return next();
  if (typeof bodyCustomerId === 'number' && bodyCustomerId !== req.storeCustomer.id) {
    void writeAuditLog(
      'store-api',
      'store.token.body-mismatch',
      `customer:${req.storeCustomer.id}`,
      `ip=${clientIp(req)} bodyCustomerId=${bodyCustomerId} tokenCustomerId=${req.storeCustomer.id}`,
    );
    res.status(403).json({ success: false, error: 'customerId in body does not match token' });
    return;
  }
  next();
}

// URL-param-id vs token-customerId match. Use after requireStoreCustomerToken
// on routes like /customers/:id where the URL identifies the target customer.
// Same enforcement gate as assertBodyCustomerMatchesToken.
export function assertParamCustomerMatchesToken(paramName: string = 'id') {
  return function (req: Request, res: Response, next: NextFunction): void {
    const enforced = process.env.ENABLE_STORE_CUSTOMER_TOKEN === 'true';
    if (!enforced || !req.storeCustomer) return next();
    const paramId = parseInt((req.params as Record<string, string>)[paramName], 10);
    if (Number.isFinite(paramId) && paramId !== req.storeCustomer.id) {
      void writeAuditLog(
        'store-api',
        'store.token.param-mismatch',
        `customer:${req.storeCustomer.id}`,
        `ip=${clientIp(req)} paramId=${paramId} tokenCustomerId=${req.storeCustomer.id} path=${req.path}`,
      );
      res.status(403).json({ success: false, error: `${paramName} does not match token customer` });
      return;
    }
    next();
  };
}

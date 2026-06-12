import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const COOKIE_NAME = 'wiz3d_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const MCP_SERVICE_TOKEN = process.env.MCP_SERVICE_TOKEN;

// Bug #60: the previous `a !== b` compare was timing-leaky. Pre-checks the
// length so timingSafeEqual doesn't throw on mismatched buffer sizes —
// otherwise it'd reveal the secret length to the caller.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function checkServiceToken(req: Request): boolean {
  if (!MCP_SERVICE_TOKEN) return false;
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (!constantTimeEqual(token, MCP_SERVICE_TOKEN)) return false;
  // Bug #60 F3: service token is now READ-ONLY. The only legitimate
  // consumer (wiz3dtools-mcp → Jarvis) only ever issues GETs. Synthetic
  // user keeps role 'service' (not 'admin') so a downstream guard that
  // checks `role === 'admin'` blocks even if a future caller tries to
  // POST. Mutating methods reject here outright.
  req.user = { userId: 0, username: 'mcp-service', role: 'service', csrfToken: '' };
  return true;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (checkServiceToken(req)) {
    if (!SAFE_METHODS.has(req.method)) {
      res.status(403).json({ success: false, error: 'Service token is read-only' });
      return;
    }
    return next();
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    req.user = verifyToken(token);
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  // CSRF check for mutating requests (cookie-auth path only)
  if (!SAFE_METHODS.has(req.method)) {
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfHeader || typeof csrfHeader !== 'string' || !constantTimeEqual(csrfHeader, req.user.csrfToken)) {
      res.status(403).json({ success: false, error: 'CSRF validation failed' });
      return;
    }
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Bug #60 F3: 'service' must NOT pass requireAdmin even though the token
  // verified — service tokens should never reach admin-only paths. Defense
  // in depth on top of the safe-methods reject above.
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore — token is invalid but not required
    }
  }
  next();
}

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

// Bug #60: the previous `a !== b` compare was timing-leaky. Pre-checks the
// length so timingSafeEqual doesn't throw on mismatched buffer sizes —
// otherwise it'd reveal the secret length to the caller.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Bug #243 (2026-08-05): the `MCP_SERVICE_TOKEN` bearer path is GONE.
// It let any holder of one static header read every non-admin GET on the
// admin API — the whole customer table (names, emails, postal addresses)
// and every invoice. Bug #60 had hardened it (read-only, role 'service',
// timing-safe compare), so it was never a takeover; the problem was
// OWNERSHIP. Its only consumer was the wiz3dtools-mcp → Jarvis bridge,
// retired 2026-07-04 (Bug #97), and the credential outlived it. A live key
// nobody owns is one nobody rotates, notices in a log, or misses when it
// leaks.
//
// The env var is also gone from `compose.yaml` (that list is an ALLOWLIST)
// and from the host `.env` on CT114. Deleting the code as well as the value
// is deliberate: a dormant `if (process.env.X)` bypass silently comes back
// to life the day someone re-adds the var. The admin API is now
// cookie-session-only. If a header-cardable read credential is ever wanted
// again, mint a NEW one with a named owner — do not resurrect this.

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
  // Positive check on 'admin', never a blocklist of non-admin roles — a new
  // role must be granted admin explicitly rather than inherit it by omission.
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

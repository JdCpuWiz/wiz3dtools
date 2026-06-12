import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Bug #60 F2: timing-safe compare for the static store key. Pre-checks
// the length so timingSafeEqual doesn't throw on size mismatch (which
// would leak the secret length).
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function requireStoreApiKey(req: Request, res: Response, next: NextFunction): void {
  const storeApiKey = process.env.STORE_API_KEY;
  if (!storeApiKey) {
    res.status(503).json({ success: false, error: 'Store API not configured' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (!constantTimeEqual(token, storeApiKey)) {
    res.status(401).json({ success: false, error: 'Invalid store API key' });
    return;
  }

  next();
}

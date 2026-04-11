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

function checkServiceToken(req: Request): boolean {
  if (!MCP_SERVICE_TOKEN) return false;
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (token !== MCP_SERVICE_TOKEN) return false;
  // Inject a synthetic admin user so downstream guards work
  req.user = { userId: 0, username: 'mcp-service', role: 'admin', csrfToken: '' };
  return true;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (checkServiceToken(req)) return next();

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

  // CSRF check for mutating requests
  if (!SAFE_METHODS.has(req.method)) {
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfHeader || csrfHeader !== req.user.csrfToken) {
      res.status(403).json({ success: false, error: 'CSRF validation failed' });
      return;
    }
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
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

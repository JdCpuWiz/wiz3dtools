import { Request, Response, NextFunction } from 'express';

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
  if (token !== storeApiKey) {
    res.status(401).json({ success: false, error: 'Invalid store API key' });
    return;
  }

  next();
}

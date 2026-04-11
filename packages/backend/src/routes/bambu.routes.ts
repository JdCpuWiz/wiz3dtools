import { Router, Request, Response, NextFunction } from 'express';
import http from 'http';

const router = Router();

const BAMBU_MONITOR_URL = process.env.BAMBU_MONITOR_URL || 'http://bambu-monitor:8015';

// Proxy live printer status from bambu-monitor service
router.get('/live', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${BAMBU_MONITOR_URL}/status`, (proxyRes) => {
        res.status(proxyRes.statusCode || 200);
        res.setHeader('Content-Type', 'application/json');
        proxyRes.pipe(res);
        proxyRes.on('end', resolve);
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('bambu-monitor timeout')));
    });
  } catch (err: any) {
    // Return empty array so the dashboard degrades gracefully when monitor is down
    res.json({ success: true, data: [], error: err.message });
  }
});

export default router;

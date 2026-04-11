import { Router, Request, Response, NextFunction } from 'express';
import http from 'http';

const router = Router();

const BAMBU_MONITOR_URL = process.env.BAMBU_MONITOR_URL || 'http://bambu-monitor:8015';

/**
 * Fire-and-forget POST to bambu-monitor /reload.
 * Called after any printer create/update/delete so the monitor picks up changes
 * immediately instead of waiting for the periodic config reload.
 */
// Proxy a single JPEG frame from bambu-monitor's port-6000 camera implementation.
router.get('/camera/frame', async (req: Request, res: Response) => {
  const serial = req.query.serial as string;
  if (!serial) { res.status(400).end(); return; }

  try {
    await new Promise<void>((resolve, reject) => {
      const request = http.get(
        `${BAMBU_MONITOR_URL}/camera/${encodeURIComponent(serial)}`,
        (proxyRes) => {
          if (proxyRes.statusCode === 200) {
            res.status(200);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'no-cache, no-store');
            proxyRes.pipe(res);
            proxyRes.on('end', resolve);
          } else {
            res.status(502).end();
            resolve();
          }
        },
      );
      request.on('error', reject);
      request.setTimeout(6000, () => reject(new Error('camera timeout')));
    });
  } catch {
    if (!res.headersSent) res.status(502).end();
  }
});

export function notifyBambuMonitorReload(): void {
  const url = new URL('/reload', BAMBU_MONITOR_URL);
  const req = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST' });
  req.on('error', () => { /* non-fatal — monitor will catch up on next poll */ });
  req.end();
}

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

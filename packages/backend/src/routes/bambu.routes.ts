import { Router, Request, Response, NextFunction } from 'express';
import http from 'http';

const router = Router();

const BAMBU_MONITOR_URL = process.env.BAMBU_MONITOR_URL || 'http://bambu-monitor:8015';

export function notifyBambuMonitorReload(): void {
  const url = new URL('/reload', BAMBU_MONITOR_URL);
  const req = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST' });
  req.on('error', () => { /* non-fatal — monitor will catch up on next poll */ });
  req.end();
}

// Proxy SSE stream from bambu-monitor — real-time printer state push
router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const upstream = http.get(`${BAMBU_MONITOR_URL}/events`, (proxyRes) => {
    proxyRes.pipe(res, { end: true });
    proxyRes.on('error', () => res.end());
  });
  upstream.on('error', () => {
    // Monitor is down — send an empty-data event so the client degrades gracefully
    res.write('data: []\n\n');
    res.end();
  });
  // Clean up upstream when client disconnects
  req.on('close', () => upstream.destroy());
});

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

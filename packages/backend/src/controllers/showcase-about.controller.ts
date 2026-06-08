import type { Request, Response } from 'express';
import {
  listShowcaseAbout,
  createShowcaseAbout,
  updateShowcaseAbout,
  deleteShowcaseAbout,
  ShowcaseAboutConfigError,
  ShowcaseAboutUpstreamError,
} from '../services/showcase-about.service.js';

const VALID_KINDS = new Set(['stat', 'equipment', 'value']);

function handleError(res: Response, err: unknown): void {
  if (err instanceof ShowcaseAboutConfigError) {
    res.status(503).json({ success: false, error: 'showcase admin not configured', detail: err.message });
    return;
  }
  if (err instanceof ShowcaseAboutUpstreamError) {
    const body = err.body as { error?: string } | undefined;
    res.status(err.status).json({ success: false, error: body?.error ?? `upstream returned ${err.status}` });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(502).json({ success: false, error: `upstream unreachable: ${message}` });
}

export class ShowcaseAboutController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await listShowcaseAbout();
      res.json({ success: true, data: items });
    } catch (err) { handleError(res, err); }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { kind, data } = req.body as { kind?: string; data?: unknown };
    if (!kind || !VALID_KINDS.has(kind)) {
      res.status(400).json({ success: false, error: 'kind must be one of: stat, equipment, value' });
      return;
    }
    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: 'data object is required' });
      return;
    }
    try {
      const item = await createShowcaseAbout(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const item = await updateShowcaseAbout(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteShowcaseAbout(req.params.id);
      res.json({ success: true });
    } catch (err) { handleError(res, err); }
  }
}

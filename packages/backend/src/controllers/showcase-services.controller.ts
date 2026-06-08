import type { Request, Response } from 'express';
import {
  listShowcaseServices,
  createShowcaseService,
  updateShowcaseService,
  deleteShowcaseService,
  ShowcaseServicesConfigError,
  ShowcaseServicesUpstreamError,
} from '../services/showcase-services.service.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ShowcaseServicesConfigError) {
    res.status(503).json({
      success: false,
      error: 'showcase admin not configured',
      detail: err.message,
    });
    return;
  }
  if (err instanceof ShowcaseServicesUpstreamError) {
    const body = err.body as { error?: string } | undefined;
    res.status(err.status).json({
      success: false,
      error: body?.error ?? `upstream returned ${err.status}`,
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(502).json({ success: false, error: `upstream unreachable: ${message}` });
}

export class ShowcaseServicesController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await listShowcaseServices();
      res.json({ success: true, data: items });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { title, description, icon } = req.body as {
      title?: string;
      description?: string;
      icon?: string;
    };
    if (!title?.trim() || !description?.trim() || !icon?.trim()) {
      res.status(400).json({
        success: false,
        error: 'title, description, and icon are required',
      });
      return;
    }
    try {
      const item = await createShowcaseService(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const item = await updateShowcaseService(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteShowcaseService(req.params.id);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err);
    }
  }
}

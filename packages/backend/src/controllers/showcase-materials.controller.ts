import type { Request, Response } from 'express';
import {
  listShowcaseMaterials,
  createShowcaseMaterial,
  updateShowcaseMaterial,
  deleteShowcaseMaterial,
  ShowcaseMaterialsConfigError,
  ShowcaseMaterialsUpstreamError,
} from '../services/showcase-materials.service.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ShowcaseMaterialsConfigError) {
    res.status(503).json({ success: false, error: 'showcase admin not configured', detail: err.message });
    return;
  }
  if (err instanceof ShowcaseMaterialsUpstreamError) {
    const body = err.body as { error?: string } | undefined;
    res.status(err.status).json({ success: false, error: body?.error ?? `upstream returned ${err.status}` });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(502).json({ success: false, error: `upstream unreachable: ${message}` });
}

export class ShowcaseMaterialsController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await listShowcaseMaterials();
      res.json({ success: true, data: items });
    } catch (err) { handleError(res, err); }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: 'name and description are required' });
      return;
    }
    try {
      const item = await createShowcaseMaterial(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const item = await updateShowcaseMaterial(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteShowcaseMaterial(req.params.id);
      res.json({ success: true });
    } catch (err) { handleError(res, err); }
  }
}

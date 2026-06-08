import type { Request, Response } from 'express';
import {
  listShowcaseTestimonials,
  createShowcaseTestimonial,
  updateShowcaseTestimonial,
  deleteShowcaseTestimonial,
  ShowcaseTestimonialsConfigError,
  ShowcaseTestimonialsUpstreamError,
} from '../services/showcase-testimonials.service.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ShowcaseTestimonialsConfigError) {
    res.status(503).json({ success: false, error: 'showcase admin not configured', detail: err.message });
    return;
  }
  if (err instanceof ShowcaseTestimonialsUpstreamError) {
    const body = err.body as { error?: string } | undefined;
    res.status(err.status).json({ success: false, error: body?.error ?? `upstream returned ${err.status}` });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(502).json({ success: false, error: `upstream unreachable: ${message}` });
}

export class ShowcaseTestimonialsController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await listShowcaseTestimonials();
      res.json({ success: true, data: items });
    } catch (err) { handleError(res, err); }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { name, role, content } = req.body as { name?: string; role?: string; content?: string };
    if (!name?.trim() || !role?.trim() || !content?.trim()) {
      res.status(400).json({ success: false, error: 'name, role, and content are required' });
      return;
    }
    try {
      const item = await createShowcaseTestimonial(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const item = await updateShowcaseTestimonial(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) { handleError(res, err); }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteShowcaseTestimonial(req.params.id);
      res.json({ success: true });
    } catch (err) { handleError(res, err); }
  }
}

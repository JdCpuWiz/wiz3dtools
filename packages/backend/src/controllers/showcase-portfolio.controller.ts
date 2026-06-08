import type { Request, Response } from 'express';
import {
  listShowcasePortfolio,
  createShowcasePortfolio,
  updateShowcasePortfolio,
  deleteShowcasePortfolio,
  ShowcasePortfolioConfigError,
  ShowcasePortfolioUpstreamError,
} from '../services/showcase-portfolio.service.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ShowcasePortfolioConfigError) {
    res.status(503).json({
      success: false,
      error: 'showcase admin not configured',
      detail: err.message,
    });
    return;
  }
  if (err instanceof ShowcasePortfolioUpstreamError) {
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

export class ShowcasePortfolioController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await listShowcasePortfolio();
      res.json({ success: true, data: items });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { title, description, category, material } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      material?: string;
    };
    if (!title?.trim() || !description?.trim() || !category?.trim() || !material?.trim()) {
      res.status(400).json({
        success: false,
        error: 'title, description, category, and material are required',
      });
      return;
    }
    try {
      const item = await createShowcasePortfolio(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const item = await updateShowcasePortfolio(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteShowcasePortfolio(req.params.id);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err);
    }
  }
}

import type { Request, Response } from 'express';
import {
  listWholesaleUsers,
  createWholesaleUser,
  updateWholesaleUser,
  deleteWholesaleUser,
  WholesaleUsersConfigError,
  WholesaleUsersUpstreamError,
} from '../services/wholesale-users.service.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof WholesaleUsersConfigError) {
    res.status(503).json({
      success: false,
      error: 'wholesale admin not configured',
      detail: err.message,
    });
    return;
  }
  if (err instanceof WholesaleUsersUpstreamError) {
    const upstreamBody = err.body as { error?: string } | undefined;
    res.status(err.status).json({
      success: false,
      error: upstreamBody?.error ?? `upstream returned ${err.status}`,
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(502).json({ success: false, error: `upstream unreachable: ${message}` });
}

export class WholesaleUsersController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const users = await listWholesaleUsers();
      res.json({ success: true, data: users });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { name, email, password, wiz3dtoolsCustomerId } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      wiz3dtoolsCustomerId?: number | null;
    };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({
        success: false,
        error: 'name, email, and password are required',
      });
      return;
    }
    try {
      const user = await createWholesaleUser({
        name: name.trim(),
        email: email.trim(),
        password,
        wiz3dtoolsCustomerId: wiz3dtoolsCustomerId ?? null,
      });
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { name, email, password, active, wiz3dtoolsCustomerId } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      active?: boolean;
      wiz3dtoolsCustomerId?: number | null;
    };
    try {
      const user = await updateWholesaleUser(req.params.id, {
        name,
        email,
        password,
        active,
        wiz3dtoolsCustomerId,
      });
      res.json({ success: true, data: user });
    } catch (err) {
      handleError(res, err);
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await deleteWholesaleUser(req.params.id);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err);
    }
  }
}

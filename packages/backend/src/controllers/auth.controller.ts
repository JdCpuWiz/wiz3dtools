import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { UserModel } from '../models/user.model.js';
import { parseBody, loginSchema, registerSchema } from '../validation/schemas.js';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = parseBody(loginSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
    const result = await authService.login(parsed.data);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = parseBody(registerSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
    const count = await UserModel.countAll();
    // Bootstrap: first user can register without a token
    // After that, require admin
    if (count > 0) {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      if (req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }
    }
    const result = await authService.register(parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserModel.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

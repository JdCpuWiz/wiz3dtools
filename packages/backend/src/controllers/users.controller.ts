import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/user.model.js';
import * as authService from '../services/auth.service.js';
import { writeAuditLog } from '../models/audit-log.model.js';
import { parseBody, createUserSchema, updateUserSchema, resetPasswordSchema } from '../validation/schemas.js';
import type { ApiResponse } from '@wizqueue/shared';

const BCRYPT_ROUNDS = 12;

export async function listUsers(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
  try {
    const users = await UserModel.findAll();
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
}

export async function createUser(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
  try {
    const parsed = parseBody(createUserSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }
    const { user, token: _token } = await authService.register(parsed.data);
    await writeAuditLog(req.user!.username, 'user.create', `user:${user.id}`, `username=${user.username} role=${user.role}`);
    res.status(201).json({ success: true, data: user, message: 'User created' });
  } catch (error) { next(error); }
}

export async function updateUser(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const parsed = parseBody(updateUserSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }

    // Prevent admin from changing their own role
    const data: { email?: string | null; role?: string } = {};
    if (parsed.data.email !== undefined) data.email = parsed.data.email || null;
    if (parsed.data.role !== undefined) {
      if (req.user?.userId === id) {
        res.status(400).json({ success: false, error: 'Cannot change your own role' });
        return;
      }
      data.role = parsed.data.role;
    }

    const user = await UserModel.update(id, data);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    await writeAuditLog(req.user!.username, 'user.update', `user:${id}`, JSON.stringify(data));
    res.json({ success: true, data: user, message: 'User updated' });
  } catch (error) { next(error); }
}

export async function resetPassword(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const parsed = parseBody(resetPasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ success: false, error: parsed.error }); return; }

    const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
    const ok = await UserModel.updatePassword(id, passwordHash);
    if (!ok) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    await writeAuditLog(req.user!.username, 'user.reset_password', `user:${id}`);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) { next(error); }
}

export async function deleteUser(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    if (req.user?.userId === id) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      return;
    }

    const ok = await UserModel.delete(id);
    if (!ok) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    await writeAuditLog(req.user!.username, 'user.delete', `user:${id}`);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) { next(error); }
}

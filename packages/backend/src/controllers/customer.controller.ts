import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service.js';
import type { ApiResponse } from '@wizqueue/shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown, res: Response<ApiResponse>): boolean {
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return false;
    }
  }
  return true;
}

const service = new CustomerService();

export class CustomerController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const customers = await service.getAll();
      res.json({ success: true, data: customers });
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const customer = await service.getById(id);
      res.json({ success: true, data: customer });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      if (!validateEmail(req.body.email, res)) return;
      const customer = await service.create(req.body);
      res.status(201).json({ success: true, data: customer, message: 'Customer created' });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      if (!validateEmail(req.body.email, res)) return;
      const customer = await service.update(id, req.body);
      res.json({ success: true, data: customer, message: 'Customer updated' });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      await service.delete(id);
      res.json({ success: true, message: 'Customer deleted' });
    } catch (error) { next(error); }
  }
}

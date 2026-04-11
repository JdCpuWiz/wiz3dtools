import { Request, Response, NextFunction } from 'express';
import { PrinterModel } from '../models/printer.model.js';
import type { ApiResponse } from '@wizqueue/shared';

export class PrinterController {
  async getAll(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const printers = await PrinterModel.findAll();
      res.json({ success: true, data: printers });
    } catch (error) { next(error); }
  }

  // Returns full config including access_code — service token only
  async getConfig(_req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const printers = await PrinterModel.findAllWithSecrets();
      res.json({ success: true, data: printers });
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { name, model, active, sortOrder, ipAddress, serialNumber, accessCode } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Name is required' }); return;
      }
      const printer = await PrinterModel.create({
        name: name.trim(),
        model: model || undefined,
        active,
        sortOrder,
        ipAddress: ipAddress || undefined,
        serialNumber: serialNumber || undefined,
        accessCode: accessCode || undefined,
      });
      res.status(201).json({ success: true, data: printer });
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const printer = await PrinterModel.update(id, req.body);
      if (!printer) { res.status(404).json({ success: false, error: 'Printer not found' }); return; }
      res.json({ success: true, data: printer });
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
      const deleted = await PrinterModel.delete(id);
      if (!deleted) { res.status(404).json({ success: false, error: 'Printer not found' }); return; }
      res.json({ success: true, message: 'Printer deleted' });
    } catch (error) { next(error); }
  }
}

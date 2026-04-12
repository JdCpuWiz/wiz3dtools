import { Request, Response, NextFunction } from 'express';
import { StoreService, CreateStoreOrderDto } from '../services/store.service.js';

const service = new StoreService();

export class StoreController {
  async getProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await service.getProducts();
      res.json({ success: true, data: products });
    } catch (error) { next(error); }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId, notes, lineItems } = req.body as CreateStoreOrderDto;

      if (!customerId || !Number.isInteger(customerId)) {
        res.status(400).json({ success: false, error: 'customerId is required' });
        return;
      }
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(400).json({ success: false, error: 'lineItems must be a non-empty array' });
        return;
      }
      for (const item of lineItems) {
        if (!item.productId || !Number.isInteger(item.productId)) {
          res.status(400).json({ success: false, error: 'Each line item must have a valid productId' });
          return;
        }
        if (!item.quantity || item.quantity < 1) {
          res.status(400).json({ success: false, error: 'Each line item must have quantity >= 1' });
          return;
        }
        if (item.unitPrice === undefined || item.unitPrice < 0) {
          res.status(400).json({ success: false, error: 'Each line item must have a valid unitPrice' });
          return;
        }
      }

      const invoice = await service.createOrder({ customerId, notes, lineItems });
      res.status(201).json({ success: true, data: invoice });
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = parseInt(req.query.customerId as string);
      if (!customerId || isNaN(customerId)) {
        res.status(400).json({ success: false, error: 'customerId query param is required' });
        return;
      }
      const orders = await service.getOrdersByCustomer(customerId);
      res.json({ success: true, data: orders });
    } catch (error) { next(error); }
  }
}

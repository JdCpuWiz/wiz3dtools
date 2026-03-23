import { Router } from 'express';
import { PrinterController } from '../controllers/printer.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
const ctrl = new PrinterController();

// All authenticated users can read printers
router.get('/', (req, res, next) => ctrl.getAll(req, res, next));

// Admin only for write operations
router.post('/', requireAdmin, (req, res, next) => ctrl.create(req, res, next));
router.put('/:id', requireAdmin, (req, res, next) => ctrl.update(req, res, next));
router.delete('/:id', requireAdmin, (req, res, next) => ctrl.delete(req, res, next));

export default router;

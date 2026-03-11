import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ColorController } from '../controllers/color.controller.js';

const router = Router();
const controller = new ColorController();

// All authenticated users can read colors
router.get('/', controller.getAll.bind(controller));

// Only admins can manage colors
router.post('/', requireAdmin, controller.create.bind(controller));
router.put('/:id', requireAdmin, controller.update.bind(controller));
router.delete('/:id', requireAdmin, controller.delete.bind(controller));

export default router;

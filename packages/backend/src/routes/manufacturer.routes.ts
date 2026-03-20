import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ManufacturerController } from '../controllers/manufacturer.controller.js';

const router = Router();
const controller = new ManufacturerController();

// All authenticated users can read manufacturers
router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));

// Only admins can manage manufacturers
router.post('/', requireAdmin, controller.create.bind(controller));
router.put('/:id', requireAdmin, controller.update.bind(controller));
router.delete('/:id', requireAdmin, controller.delete.bind(controller));

export default router;

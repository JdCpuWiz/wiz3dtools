import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/categories — all users can read
router.get('/', CategoryController.list);
router.get('/:id', CategoryController.get);

// Mutations — admin only
router.post('/', requireAdmin, CategoryController.create);
router.put('/:id', requireAdmin, CategoryController.update);
router.delete('/:id', requireAdmin, CategoryController.remove);

export default router;

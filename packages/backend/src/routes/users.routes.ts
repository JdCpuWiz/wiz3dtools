import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import * as usersController from '../controllers/users.controller.js';

const router = Router();

// All routes require admin (requireAuth already applied globally before /api routes)
router.use(requireAdmin);

router.get('/', usersController.listUsers);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.post('/:id/reset-password', usersController.resetPassword);
router.delete('/:id', usersController.deleteUser);

export default router;

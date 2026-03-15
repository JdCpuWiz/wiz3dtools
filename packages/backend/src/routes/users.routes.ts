import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/auth.middleware.js';
import * as usersController from '../controllers/users.controller.js';

const router = Router();

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password reset attempts, please try again later' },
});

// All routes require admin (requireAuth already applied globally before /api routes)
router.use(requireAdmin);

router.get('/', usersController.listUsers);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.post('/:id/reset-password', resetPasswordLimiter, usersController.resetPassword);
router.delete('/:id', usersController.deleteUser);

export default router;

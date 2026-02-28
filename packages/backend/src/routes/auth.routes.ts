import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/register', optionalAuth, authController.register);
router.get('/me', requireAuth, authController.me);

export default router;

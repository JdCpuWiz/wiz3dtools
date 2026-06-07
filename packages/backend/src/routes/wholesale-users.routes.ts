import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { WholesaleUsersController } from '../controllers/wholesale-users.controller.js';

const router = Router();

// All wholesale-user CRUD is admin-only. requireAuth is already applied
// upstream in index.ts via `app.use('/api', requireAuth)`.
router.use(requireAdmin);

router.get('/', WholesaleUsersController.list);
router.post('/', WholesaleUsersController.create);
router.patch('/:id', WholesaleUsersController.update);
router.delete('/:id', WholesaleUsersController.remove);

export default router;

import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ShowcaseMaterialsController } from '../controllers/showcase-materials.controller.js';

const router = Router();
router.use(requireAdmin);
router.get('/', ShowcaseMaterialsController.list);
router.post('/', ShowcaseMaterialsController.create);
router.put('/:id', ShowcaseMaterialsController.update);
router.delete('/:id', ShowcaseMaterialsController.remove);
export default router;

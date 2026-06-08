import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ShowcaseAboutController } from '../controllers/showcase-about.controller.js';

const router = Router();
router.use(requireAdmin);
router.get('/', ShowcaseAboutController.list);
router.post('/', ShowcaseAboutController.create);
router.put('/:id', ShowcaseAboutController.update);
router.delete('/:id', ShowcaseAboutController.remove);
export default router;

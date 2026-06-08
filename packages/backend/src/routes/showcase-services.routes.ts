import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ShowcaseServicesController } from '../controllers/showcase-services.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/', ShowcaseServicesController.list);
router.post('/', ShowcaseServicesController.create);
router.put('/:id', ShowcaseServicesController.update);
router.delete('/:id', ShowcaseServicesController.remove);

export default router;

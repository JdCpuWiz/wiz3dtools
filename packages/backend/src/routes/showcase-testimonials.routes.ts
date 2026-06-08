import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ShowcaseTestimonialsController } from '../controllers/showcase-testimonials.controller.js';

const router = Router();
router.use(requireAdmin);
router.get('/', ShowcaseTestimonialsController.list);
router.post('/', ShowcaseTestimonialsController.create);
router.put('/:id', ShowcaseTestimonialsController.update);
router.delete('/:id', ShowcaseTestimonialsController.remove);
export default router;

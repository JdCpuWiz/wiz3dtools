import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ShowcasePortfolioController } from '../controllers/showcase-portfolio.controller.js';

const router = Router();

// All routes require admin (requireAuth applied globally in index.ts).
router.use(requireAdmin);

router.get('/', ShowcasePortfolioController.list);
router.post('/', ShowcasePortfolioController.create);
router.put('/:id', ShowcasePortfolioController.update);
router.delete('/:id', ShowcasePortfolioController.remove);

export default router;

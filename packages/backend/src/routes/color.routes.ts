import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ColorController } from '../controllers/color.controller.js';

const router = Router();
const controller = new ColorController();

// All authenticated users can read colors
router.get('/', controller.getAll.bind(controller));

// Bug #66 — admin-only duplicate discovery + merge
router.get('/duplicates', requireAdmin, controller.duplicates.bind(controller));
router.post('/merge', requireAdmin, controller.merge.bind(controller));

// Only admins can manage colors
router.post('/', requireAdmin, controller.create.bind(controller));
router.put('/:id', requireAdmin, controller.update.bind(controller));
router.delete('/:id', requireAdmin, controller.delete.bind(controller));
router.post('/:id/add-spool', requireAdmin, controller.addSpool.bind(controller));

// BuildPlan #6 Phase 4 — admin-only pull from BamBuddy's filament catalog
router.post('/sync-from-bambuddy', requireAdmin, controller.syncFromBambuddy.bind(controller));

export default router;

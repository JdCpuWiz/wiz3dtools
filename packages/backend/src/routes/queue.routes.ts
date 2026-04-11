import { Router, Request, Response, NextFunction } from 'express';
import { QueueController } from '../controllers/queue.controller.js';
import { ColorController } from '../controllers/color.controller.js';
import { QueueItemModel } from '../models/queue-item.model.js';

const router = Router();
const queueController = new QueueController();
const colorController = new ColorController();

// Called by Bambu monitor when a print starts or finishes on a printer.
// Finds the oldest in-house queue item assigned to that printer and advances
// its status: pending → printing (on start) or printing → completed (on finish).
// Returns { queueItemId } so the caller can link filament_jobs to it.
// Service-token only (userId === 0).
router.post('/inhouse-transition', async (req: Request, res: Response, _next: NextFunction) => {
  const { printerName, event } = req.body as { printerName?: string; event?: string };
  if (!printerName || (event !== 'start' && event !== 'finish')) {
    res.status(400).json({ success: false, error: 'printerName and event (start|finish) required' });
    return;
  }
  const fromStatus = event === 'start' ? 'pending' : 'printing';
  const toStatus   = event === 'start' ? 'printing' : 'completed';

  const item = await QueueItemModel.findForPrinter(printerName, fromStatus);
  if (!item) {
    res.json({ success: true, queueItemId: null });
    return;
  }
  await QueueItemModel.update(item.id, { status: toStatus as any });
  res.json({ success: true, queueItemId: item.id });
});

// Get all queue items
router.get('/', (req, res, next) => queueController.getAll(req, res, next));

// Get single queue item
router.get('/:id', (req, res, next) => queueController.getById(req, res, next));

// Create single queue item
router.post('/', (req, res, next) => queueController.create(req, res, next));

// Create multiple queue items (batch)
router.post('/batch', (req, res, next) => queueController.createBatch(req, res, next));

// Update queue item
router.put('/:id', (req, res, next) => queueController.update(req, res, next));

// Delete queue item
router.delete('/:id', (req, res, next) => queueController.delete(req, res, next));

// Reorder queue items
router.patch('/reorder', (req, res, next) => queueController.reorder(req, res, next));

// Update queue item status
router.patch('/:id/status', (req, res, next) => queueController.updateStatus(req, res, next));

// Set colors on a queue item
router.put('/:id/colors', (req, res, next) => colorController.setQueueItemColors(req, res, next));

export default router;

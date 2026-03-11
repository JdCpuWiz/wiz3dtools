import { Router } from 'express';
import { QueueController } from '../controllers/queue.controller.js';
import { ColorController } from '../controllers/color.controller.js';

const router = Router();
const queueController = new QueueController();
const colorController = new ColorController();

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

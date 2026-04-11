import { Router } from 'express';
import { FilamentJobController } from '../controllers/filament-job.controller.js';

const router = Router();
const ctrl = new FilamentJobController();

router.get('/',                              (req, res, next) => ctrl.getAll(req, res, next));
router.get('/last-print',                    (req, res, next) => ctrl.getLastByPrinter(req, res, next));
router.get('/by-queue-item/:queueItemId',    (req, res, next) => ctrl.getByQueueItem(req, res, next));
router.post('/',                             (req, res, next) => ctrl.create(req, res, next));
router.put('/:id/resolve',                   (req, res, next) => ctrl.resolve(req, res, next));
router.put('/:id/skip',                      (req, res, next) => ctrl.skip(req, res, next));

export default router;

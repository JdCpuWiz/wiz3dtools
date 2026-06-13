import { Router } from 'express';
import { SalesInvoiceController } from '../controllers/sales-invoice.controller.js';
import { ColorController } from '../controllers/color.controller.js';

const router = Router();
const controller = new SalesInvoiceController();
const colorController = new ColorController();

router.get('/', controller.getAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

router.post('/:id/line-items', controller.addLineItem.bind(controller));
router.put('/:id/line-items/:itemId', controller.updateLineItem.bind(controller));
router.delete('/:id/line-items/:itemId', controller.deleteLineItem.bind(controller));
router.patch('/:id/line-items/:itemId/status', controller.updateLineItemStatus.bind(controller));
router.put('/:id/line-items/:itemId/colors', colorController.setLineItemColors.bind(colorController));

router.post('/:id/send', controller.sendEmail.bind(controller));
router.post('/:id/ship', controller.ship.bind(controller));
// /send-to-queue removed in BuildPlan #6 Phase 3 — printing is manual via BamBuddy.
router.get('/:id/pdf', controller.downloadPdf.bind(controller));

export default router;

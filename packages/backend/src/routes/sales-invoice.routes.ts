import { Router } from 'express';
import { SalesInvoiceController } from '../controllers/sales-invoice.controller.js';

const router = Router();
const controller = new SalesInvoiceController();

router.get('/', controller.getAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

router.post('/:id/line-items', controller.addLineItem.bind(controller));
router.put('/:id/line-items/:itemId', controller.updateLineItem.bind(controller));
router.delete('/:id/line-items/:itemId', controller.deleteLineItem.bind(controller));

router.post('/:id/send', controller.sendEmail.bind(controller));
router.post('/:id/send-to-queue', controller.sendToQueue.bind(controller));
router.get('/:id/pdf', controller.downloadPdf.bind(controller));

export default router;

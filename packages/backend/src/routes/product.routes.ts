import { Router } from 'express';
import { ProductController } from '../controllers/product.controller.js';

const router = Router();
const controller = new ProductController();

router.get('/', controller.getAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/suggest-sku', controller.suggestSku.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/:id/copy', controller.copy.bind(controller));
router.get('/:id/colors', controller.getColors.bind(controller));
router.put('/:id/colors', controller.setColors.bind(controller));

export default router;

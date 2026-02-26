import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller.js';

const router = Router();
const controller = new CustomerController();

router.get('/', controller.getAll.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;

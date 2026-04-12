import { Router } from 'express';
import { requireStoreApiKey } from '../middleware/store-api-key.middleware.js';
import { StoreController } from '../controllers/store.controller.js';

const router = Router();
const controller = new StoreController();

// All store routes require the API key — no cookie auth, no CSRF
router.use(requireStoreApiKey);

router.get('/products', controller.getProducts.bind(controller));
router.post('/orders', controller.createOrder.bind(controller));
router.get('/orders', controller.getOrders.bind(controller));
router.get('/customers/:id', controller.getCustomer.bind(controller));
router.patch('/customers/:id', controller.updateCustomer.bind(controller));

export default router;

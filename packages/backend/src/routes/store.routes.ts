import { Router } from 'express';
import { requireStoreApiKey } from '../middleware/store-api-key.middleware.js';
import {
  requireStoreCustomerToken,
  assertBodyCustomerMatchesToken,
  assertParamCustomerMatchesToken,
} from '../middleware/store-customer-token.middleware.js';
import { StoreController } from '../controllers/store.controller.js';

const router = Router();
const controller = new StoreController();

// All store routes require the static STORE_API_KEY — proves the caller
// is a trusted service (wiz3d-prints). Per-customer scope, when
// applicable, is layered on top via requireStoreCustomerToken.
router.use(requireStoreApiKey);

// ── Service-scope routes (no specific customer) ──────────────────────────────
router.get('/products', controller.getProducts.bind(controller));
router.get('/colors', controller.getColors.bind(controller));
// Customer signup: creates the customer row. wiz3d-prints follows up with
// a separate flow to set password_hash before login is possible.
router.post('/customers', controller.createCustomer.bind(controller));
// Token mint: takes email + password, returns the per-customer token.
router.post('/customers/token', controller.issueCustomerToken.bind(controller));

// ── Per-customer scope routes — Change #148 F7 ───────────────────────────────
// requireStoreCustomerToken behavior is gated by ENABLE_STORE_CUSTOMER_TOKEN
// (no-op pass-through when false). assertBodyCustomerMatchesToken only
// blocks when both the flag is on AND a token was successfully verified.
router.post('/orders', requireStoreCustomerToken, assertBodyCustomerMatchesToken, controller.createOrder.bind(controller));
router.get('/orders', requireStoreCustomerToken, controller.getOrders.bind(controller));
router.get('/orders/:id', requireStoreCustomerToken, controller.getOrder.bind(controller));
router.post('/orders/:id/mark-paid', requireStoreCustomerToken, assertBodyCustomerMatchesToken, controller.markPaid.bind(controller));
router.get('/customers/:id', requireStoreCustomerToken, assertParamCustomerMatchesToken('id'), controller.getCustomer.bind(controller));
router.patch('/customers/:id', requireStoreCustomerToken, assertParamCustomerMatchesToken('id'), controller.updateCustomer.bind(controller));

export default router;

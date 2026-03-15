import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';
import { uploadMiddleware, validatePdfMagicBytes } from '../middleware/upload.middleware.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const uploadController = new UploadController();

// Rate limit for upload endpoint (max 10 uploads per 15 minutes)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload PDF invoice
router.post(
  '/',
  uploadLimiter,
  uploadMiddleware.single('invoice'),
  validatePdfMagicBytes,
  (req, res, next) => uploadController.uploadInvoice(req, res, next)
);

// Get invoice processing status
router.get('/:id', (req, res, next) => uploadController.getInvoiceStatus(req, res, next));

// Get all invoices
router.get('/', (req, res, next) => uploadController.getAllInvoices(req, res, next));

export default router;

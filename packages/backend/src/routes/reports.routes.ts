import { Router } from 'express';
import { getSalesReportData, downloadSalesReportPdf } from '../controllers/reports.controller.js';

const router = Router();

router.get('/sales', getSalesReportData);
router.get('/sales/pdf', downloadSalesReportPdf);

export default router;

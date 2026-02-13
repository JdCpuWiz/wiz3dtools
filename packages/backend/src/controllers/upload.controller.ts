import { Request, Response, NextFunction } from 'express';
import { InvoiceModel } from '../models/invoice.model.js';
import { OllamaService } from '../services/ollama.service.js';
import type { ApiResponse } from '@wizqueue/shared';
import fs from 'fs/promises';

const ollamaService = new OllamaService();

export class UploadController {
  async uploadInvoice(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { filename, path: filePath } = req.file;

      // Create invoice record
      const invoice = await InvoiceModel.create(filename, filePath);

      // Start processing in background
      this.processInvoiceAsync(invoice.id, filePath);

      res.status(201).json({
        success: true,
        data: {
          invoiceId: invoice.id,
          filename: invoice.filename,
          message: 'Invoice uploaded successfully. Processing started.',
        },
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  }

  async getInvoiceStatus(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
        });
      }

      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
      }

      res.json({
        success: true,
        data: {
          invoiceId: invoice.id,
          processed: invoice.processed,
          processingError: invoice.processingError,
          extractedData: invoice.extractedData,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllInvoices(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const invoices = await InvoiceModel.findAll(limit);

      res.json({
        success: true,
        data: invoices,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process invoice asynchronously
   */
  private async processInvoiceAsync(invoiceId: number, filePath: string): Promise<void> {
    try {
      console.log(`🚀 Starting background processing for invoice ${invoiceId}`);

      const extractedProducts = await ollamaService.extractProductsFromPdf(filePath);

      await InvoiceModel.markAsProcessed(invoiceId, extractedProducts);

      console.log(`✅ Invoice ${invoiceId} processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing invoice ${invoiceId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await InvoiceModel.markAsFailed(invoiceId, errorMessage);
    }
  }
}

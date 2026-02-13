import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@wizqueue/shared';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Multer errors
  if (err.message?.includes('File too large')) {
    res.status(413).json({
      success: false,
      error: 'File too large',
      message: err.message,
    });
  }

  if (err.message?.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: err.message,
    });
  }

  // Database errors
  if (err.message?.includes('violates')) {
    res.status(400).json({
      success: false,
      error: 'Database constraint violation',
      message: err.message,
    });
  }

  // Not found errors
  if (err.message?.includes('not found')) {
    res.status(404).json({
      success: false,
      error: 'Resource not found',
      message: err.message,
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
}

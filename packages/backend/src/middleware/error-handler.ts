import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@wizqueue/shared';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Errors with an explicit HTTP status code (e.g. 409 Conflict)
  const explicitStatus = (err as any).statusCode as number | undefined;
  if (explicitStatus) {
    res.status(explicitStatus).json({ success: false, error: err.message, message: err.message });
    return;
  }

  // Multer errors
  if (err.message?.includes('File too large')) {
    res.status(413).json({ success: false, error: 'File too large' });
    return;
  }

  if (err.message?.includes('Invalid file type')) {
    res.status(400).json({ success: false, error: 'Invalid file type' });
    return;
  }

  // Database errors
  if (err.message?.includes('violates')) {
    res.status(400).json({ success: false, error: 'Database constraint violation' });
    return;
  }

  // Not found errors
  if (err.message?.includes('not found')) {
    res.status(404).json({ success: false, error: 'Resource not found' });
    return;
  }

  // Default error — never leak internal details to client
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

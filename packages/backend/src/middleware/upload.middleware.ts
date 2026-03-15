import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { Request, Response, NextFunction } from 'express';

// Resolve and validate upload directory
const rawUploadDir = process.env.UPLOAD_DIR || './uploads';
const uploadDir = path.resolve(rawUploadDir);
const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || './');
if (!uploadDir.startsWith(uploadRoot)) {
  console.error(`UPLOAD_DIR "${uploadDir}" is outside allowed root "${uploadRoot}". Exiting.`);
  process.exit(1);
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow PDFs
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'application/pdf').split(',');

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Configure multer
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
});

// Validate actual PDF magic bytes after multer saves the file
export async function validatePdfMagicBytes(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.file) { next(); return; }
  try {
    const buffer = await fsPromises.readFile(req.file.path);
    if (buffer.toString('utf8', 0, 4) !== '%PDF') {
      await fsPromises.unlink(req.file.path);
      res.status(400).json({ success: false, error: 'Uploaded file is not a valid PDF' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ success: false, error: 'Failed to validate uploaded file' });
  }
}

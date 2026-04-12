import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Magic bytes: JPEG = FF D8 FF, PNG = 89 50 4E 47, WEBP = starts with RIFF....WEBP
const IMAGE_MAGIC: Array<{ mime: string; bytes: Buffer }> = [
  { mime: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff]) },
  { mime: 'image/png',  bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
];

function getStoreUploadDir(): string {
  const rawUploadDir = process.env.UPLOAD_DIR || './uploads';
  const storeDir = path.resolve(rawUploadDir, 'store');
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  return storeDir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getStoreUploadDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPEG, PNG, WEBP'));
  }
};

export const imageUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '5242880'), // 5MB default
  },
});

export async function validateImageMagicBytes(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.file) { next(); return; }
  try {
    const fd = await fsPromises.open(req.file.path, 'r');
    const header = Buffer.alloc(12);
    await fd.read(header, 0, 12, 0);
    await fd.close();

    // WEBP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
    const isWebp = header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    const isValid =
      isWebp ||
      IMAGE_MAGIC.some((m) => header.slice(0, m.bytes.length).equals(m.bytes));

    if (!isValid) {
      await fsPromises.unlink(req.file.path);
      res.status(400).json({ success: false, error: 'Uploaded file is not a valid image' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ success: false, error: 'Failed to validate uploaded image' });
  }
}

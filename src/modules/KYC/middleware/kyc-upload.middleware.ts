import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';

const storage = multer.memoryStorage();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = [
    'image/jpeg', 'image/png',
    'image/jpg', 'image/webp', 'image/heic',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed (JPEG, PNG, WebP)'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('document'); // field name must be 'document'

export const handleKYCUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Document too large. Maximum size is 10MB.',
        });
        return;
      }
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    try {
      if (!req.file?.buffer) {
        res.status(400).json({ success: false, message: 'Document file is required.' });
        return;
      }

      const metadata = await sharp(req.file.buffer).metadata();
      const allowedFormats = new Set(['jpeg', 'png', 'webp', 'heif']);
      if (!metadata.format || !allowedFormats.has(metadata.format)) {
        res.status(400).json({
          success: false,
          message: 'Invalid image file. Please upload JPEG, PNG, WebP, or HEIC.',
        });
        return;
      }
      next();
    } catch {
      res.status(400).json({
        success: false,
        message: 'Invalid image file. Please upload a valid document image.',
      });
    }
  });
};

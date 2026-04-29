import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'image/heic',
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
}).single('avatar');                        // field name must be 'avatar'

export const handleUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Image is too large. Maximum size is 5MB.',
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
    next();
  });
};
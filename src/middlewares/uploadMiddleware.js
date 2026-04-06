import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const logosDir = path.join(uploadsRoot, 'logos');

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.png';
    cb(null, `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const imageFileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only image files are allowed'));
  }
  cb(null, true);
};

export const uploadLogoMiddleware = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
}).single('logo');

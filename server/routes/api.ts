import express from 'express';
const router = express.Router();
import multer from 'multer';
import jobController from '../controllers/JobController.ts';
import systemController from '../controllers/SystemController.ts';
import config from '../config.ts';

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.dirs.uploads);
  },
  filename: (req, file, cb) => {
    // Fix encoding for non-latin characters
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, file.originalname);
  }
});

const allowedTypes = [...config.upload.allowedVideoTypes, ...config.upload.allowedAudioTypes];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Недопустимый тип файла: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter,
});

// Routes
router.get('/jobs/:clientId', jobController.getJobs);
router.post('/upload', (req, res, next) => {
  upload.single('video')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ error: 'Multer error', details: err.message });
    }
    next();
  });
}, jobController.upload);
router.post('/cancel', express.json(), jobController.cancel);
router.post('/delete', express.json(), jobController.delete);
router.post('/transcribe', express.json(), jobController.transcribe);
router.get('/system-info', systemController.getSystemInfo);

// AI Text Correction using Google Gemini
router.post('/correct', express.json(), jobController.correctText);

export default router;

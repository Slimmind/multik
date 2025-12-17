const express = require('express');
const router = express.Router();
const multer = require('multer');
const jobController = require('../controllers/JobController');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Fix encoding for non-latin characters
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// Routes
router.get('/jobs/:clientId', jobController.getJobs);
router.post('/upload', upload.single('video'), jobController.upload);
router.post('/cancel', express.json(), jobController.cancel);
router.post('/delete', express.json(), jobController.delete);
router.post('/transcribe', express.json(), jobController.transcribe);

// AI Text Correction using Google Gemini
router.post('/correct', express.json(), jobController.correctText);

module.exports = router;

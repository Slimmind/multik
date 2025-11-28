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

module.exports = router;

const express = require('express');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const jobService = require('./server/services/JobService');
const ffmpegService = require('./server/services/FFmpegService');
const queueService = require('./server/services/QueueService');
const socketHandler = require('./server/socket/SocketHandler');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);
const PORT = 3000;

// Initialize Socket Handler
socketHandler.init(io);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });
app.use(express.static('public'));
app.use('/output', express.static('output'));

if (!fs.existsSync('output')) fs.mkdirSync('output');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.get('/jobs/:clientId', (req, res) => {
  const { clientId } = req.params;
  const userJobs = jobService.getUserJobs(clientId).map(job => ({
    id: job.id,
    filename: job.filename,
    status: job.status,
    progress: job.progress,
    url: job.url,
    error: job.error,
    compressionRatio: job.compressionRatio,
    thumbnail: job.thumbnail
  }));
  res.json(userJobs);
});

app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нет файла' });

  const clientId = req.body.clientId;
  const jobId = req.body.jobId;

  if (!clientId || !jobId) return res.status(400).json({ error: 'Нет clientId или jobId' });

  const job = jobService.createJob(jobId, clientId, req.file);
  res.json({ status: 'queued' });

  // Generate thumbnail asynchronously
  ffmpegService.generateThumbnail(job, (err, url) => {
    if (!err) {
      job.thumbnail = url;
      socketHandler.emitToClient(clientId, 'thumbnail', { id: jobId, url });
      console.log(`Thumbnail generated for ${jobId}`);
    } else {
      console.error(`Thumbnail generation failed for ${jobId}:`, err);
    }
  });

  queueService.processQueue();
});

app.post('/cancel', express.json(), (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Нет jobId' });

  const job = jobService.getJob(jobId);
  if (job) {
    if (job.status === 'processing' && job.process) {
      job.process.kill('SIGKILL');
      job.status = 'cancelled';
      job.process = null;
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
      if (job.inputPath) {
        fs.unlink(job.inputPath, () => {});
      }
    }
    return res.json({ status: 'cancelled' });
  }

  res.status(404).json({ error: 'Процесс не найден' });
});

app.post('/delete', express.json(), (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Нет jobId' });

  const job = jobService.getJob(jobId);
  if (job) {
    console.log(`Deleting job ${jobId}`);

    jobService.deleteJob(jobId);

    if (job.url) {
      const outputPath = path.join(__dirname, job.url);
      fs.unlink(outputPath, (err) => {
        if (err) console.error('Error deleting output file:', err);
        else console.log(`Deleted output file: ${outputPath}`);
      });
    }

    if (job.thumbnail) {
      const thumbPath = path.join(__dirname, job.thumbnail);
      fs.unlink(thumbPath, (err) => {
        if (err) console.error('Error deleting thumbnail:', err);
        else console.log(`Deleted thumbnail: ${thumbPath}`);
      });
    }

    return res.json({ status: 'deleted' });
  }

  res.status(404).json({ error: 'Задание не найдено' });
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
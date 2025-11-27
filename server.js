const express = require('express');
const http = require('http');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);
const PORT = 3000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8'); // Фикс для кириллицы в multer
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });
app.use(express.static('public'));
app.use('/output', express.static('output'));

if (!fs.existsSync('output')) fs.mkdirSync('output');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Парсим строку времени вида "00:01:23.45" → секунды
function timeToSeconds(timeStr) {
  const [h, m, s] = timeStr.split(':').map(parseFloat);
  return h * 3600 + m * 60 + s;
}

// Хранилище заданий: jobId -> { ... }
const jobs = new Map();
// Хранилище клиентов: clientId -> socketId
const clients = new Map();

let isConverting = false;

io.on('connection', (socket) => {
  const clientId = socket.handshake.query.clientId;
  if (clientId) {
    clients.set(clientId, socket.id);
    console.log(`Client connected: ${clientId} -> ${socket.id}`);
  }

  socket.on('disconnect', () => {
    if (clientId && clients.get(clientId) === socket.id) {
      clients.delete(clientId);
    }
  });
});

app.get('/jobs/:clientId', (req, res) => {
  const { clientId } = req.params;
  const userJobs = [];

  for (const [id, job] of jobs.entries()) {
    if (job.clientId === clientId) {
      userJobs.push({
        id: job.id,
        filename: job.filename,
        status: job.status,
        progress: job.progress,
        url: job.url,
        error: job.error
      });
    }
  }

  res.json(userJobs);
});

app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нет файла' });

  const clientId = req.body.clientId;
  const jobId = req.body.jobId; // Клиент генерирует ID

  if (!clientId || !jobId) return res.status(400).json({ error: 'Нет clientId или jobId' });

  // Создаем запись о задании
  jobs.set(jobId, {
    id: jobId,
    clientId,
    filename: req.file.originalname,
    inputPath: req.file.path,
    status: 'queued',
    progress: 0,
    process: null
  });

  res.json({ status: 'queued' });

  // Пытаемся запустить обработку
  processQueue();
});

function processQueue() {
  if (isConverting) return;

  // Найти следующее задание (самое старое queued)
  let nextJob = null;
  for (const job of jobs.values()) {
    if (job.status === 'queued') {
      nextJob = job;
      break;
    }
  }

  if (!nextJob) return;

  startConversion(nextJob);
}

function startConversion(job) {
  isConverting = true;
  job.status = 'processing';

  const socketId = clients.get(job.clientId);
  if (socketId) {
    io.to(socketId).emit('status_change', { id: job.id, status: 'processing' });
  }

  const originalName = path.parse(job.filename).name;
  const outputFile = path.join('output', `${originalName}.mp4`);

  const ffmpeg = spawn('ffmpeg', [
    '-threads', '2',
    '-i', job.inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-threads', '2',
    '-x264-params', 'threads=2',
    '-c:a', 'aac',
    '-y',
    outputFile
  ]);

  job.process = ffmpeg;

  let duration = null;
  let stderr = '';

  ffmpeg.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderr += chunk;

    if (duration === null) {
      const durMatch = stderr.match(/Duration: (\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (durMatch) {
        duration = timeToSeconds(durMatch[1]);
      }
    }

    const timeMatches = [...chunk.matchAll(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/g)];
    if (timeMatches.length > 0 && duration) {
      const lastMatch = timeMatches[timeMatches.length - 1];
      const currentTime = timeToSeconds(lastMatch[1]);
      const progress = Math.min(99, Math.floor((currentTime / duration) * 100));

      job.progress = progress;

      const socketId = clients.get(job.clientId);
      if (socketId) {
        io.to(socketId).emit('progress', { id: job.id, progress });
      }
    }
  });

  ffmpeg.on('close', (code, signal) => {
    isConverting = false;
    fs.unlink(job.inputPath, () => { }); // Удаляем исходник

    if (signal === 'SIGKILL' || signal === 'SIGTERM') {
      fs.unlink(outputFile, () => { });
      job.status = 'cancelled';
      // Уведомление клиенту уже могло уйти при отмене
    } else if (code === 0) {
      const url = `/output/${path.basename(outputFile)}`;
      job.status = 'completed';
      job.progress = 100;
      job.url = url;

      const socketId = clients.get(job.clientId);
      if (socketId) {
        io.to(socketId).emit('complete', { id: job.id, url });
      }
    } else {
      console.error('FFmpeg error:\n', stderr);
      job.status = 'error';
      job.error = 'Конвертация не удалась';

      const socketId = clients.get(job.clientId);
      if (socketId) {
        io.to(socketId).emit('error', { id: job.id, message: 'Конвертация не удалась' });
      }
    }

    // Запускаем следующее задание
    processQueue();
  });
}

app.post('/cancel', express.json(), (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Нет jobId' });

  const job = jobs.get(jobId);
  if (job) {
    if (job.status === 'processing' && job.process) {
      job.process.kill('SIGKILL');
      job.status = 'cancelled';
      job.process = null;
      // isConverting сбросится в обработчике close
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
      // Удаляем файл, если он был загружен
      if (job.inputPath) {
        fs.unlink(job.inputPath, () => {});
      }
    }
    return res.json({ status: 'cancelled' });
  }

  res.status(404).json({ error: 'Процесс не найден' });
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
const path = require('path');
const fs = require('fs');
const jobService = require('../services/JobService');
const ffmpegService = require('../services/FFmpegService');
const queueService = require('../services/QueueService');
const socketHandler = require('../socket/SocketHandler');

class JobController {

  getJobs(req, res) {
    const { clientId } = req.params;
    const userJobs = jobService.getUserJobs(clientId).map(job => ({
      id: job.id,
      filename: job.filename,
      status: job.status,
      progress: job.progress,
      url: job.url,
      error: job.error,
      error: job.error,
      compressionRatio: job.compressionRatio,
      thumbnail: job.thumbnail,
      mode: job.mode || 'video'
    }));
    res.json(userJobs);
  }

  upload(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: 'Нет файла' });

        const clientId = req.body.clientId;
        const jobId = req.body.jobId;
        const mode = req.body.mode || 'video';

        if (!clientId || !jobId) return res.status(400).json({ error: 'Нет clientId или jobId' });

        const job = jobService.createJob(jobId, clientId, req.file, mode);
        res.json({ status: 'queued' });

        // Generate thumbnail asynchronously only for video
        if (mode === 'video') {
          ffmpegService.generateThumbnail(job, (err, url) => {
            if (!err) {
              job.thumbnail = url;
              socketHandler.emitToClient(clientId, 'thumbnail', { id: jobId, url });
              console.log(`Thumbnail generated for ${jobId}`);
            } else {
              console.error(`Thumbnail generation failed for ${jobId}:`, err);
            }
          });
        }

        queueService.processQueue();
    } catch (e) {
        console.error('Upload error:', e);
        // If headers not sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error during upload', details: e.message });
        }
    }
  }

  cancel(req, res) {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'Нет jobId' });

    const result = queueService.cancelJob(jobId);
    if (result) {
      return res.json({ status: 'cancelled' });
    }

    // If queueService didn't find it or couldn't cancel, check if it exists at all
    const job = jobService.getJob(jobId);
    if (job) {
      // If it exists but wasn't cancellable by queueService (e.g. completed or error), just return status
      return res.json({ status: job.status });
    }

    res.status(404).json({ error: 'Процесс не найден' });
  }

  delete(req, res) {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'Нет jobId' });

    const job = jobService.getJob(jobId);
    if (job) {
      console.log(`Deleting job ${jobId}`);

      jobService.deleteJob(jobId);

      // Helper to safely delete files
      const safeUnlink = (filePath, type) => {
        if (!filePath) return;
        // Ensure absolute path if not already
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(__dirname, '../../', filePath); // Adjust relative to controller if needed, but services usually store relative to root or absolute

        // Actually, JobService/FFmpegService seem to store relative paths like 'output/file.mp4' or absolute paths.
        // Let's rely on how they are stored. If they are relative to project root:
        const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

        fs.unlink(targetPath, (err) => {
          if (err && err.code !== 'ENOENT') console.error(`Error deleting ${type}:`, err);
          else if (!err) console.log(`Deleted ${type}: ${targetPath}`);
        });
      };

      safeUnlink(job.url, 'output file');
      safeUnlink(job.thumbnail, 'thumbnail');

      // Also try to delete input file if it still exists
      safeUnlink(job.inputPath, 'input file');

      return res.json({ status: 'deleted' });
    }

    res.status(404).json({ error: 'Задание не найдено' });
  }

  transcribe(req, res) {
    const { jobId, audioUrl, clientId } = req.body;
    if (!jobId || !audioUrl || !clientId) {
      return res.status(400).json({ error: 'Нет jobId, audioUrl или clientId' });
    }

    // audioUrl is like "/output/filename.mp3"
    // Convert to file system path
    const audioPath = path.resolve('.' + audioUrl);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }

    // Create a transcription job using the existing audio file
    const job = jobService.createJobFromPath(jobId, clientId, audioPath, 'transcription');
    res.json({ status: 'queued' });

    queueService.processQueue();
  }

  async correctText(req, res) {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Нет текста для обработки' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Исправь орфографические ошибки и ошибки пунктуации в следующем тексте. Верни только исправленный текст без каких-либо пояснений:\n\n${text}`
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return res.status(500).json({ error: 'Ошибка API' });
      }

      const data = await response.json();
      const correctedText = data.candidates?.[0]?.content?.parts?.[0]?.text || text;

      res.json({ correctedText });
    } catch (e) {
      console.error('AI correction error:', e);
      res.status(500).json({ error: 'Ошибка обработки' });
    }
  }
}

module.exports = new JobController();

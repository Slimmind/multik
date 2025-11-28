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
      compressionRatio: job.compressionRatio,
      thumbnail: job.thumbnail
    }));
    res.json(userJobs);
  }

  upload(req, res) {
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
}

module.exports = new JobController();

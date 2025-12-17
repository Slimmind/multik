const jobService = require('./JobService');
const ffmpegService = require('./FFmpegService');
const transcriptionService = require('./TranscriptionService');
const socketHandler = require('../socket/SocketHandler');

const fs = require('fs');

class QueueService {
  constructor() {
    this.isConverting = false;
  }

  processQueue() {
    if (this.isConverting) return;

    const nextJob = jobService.getNextQueuedJob();
    if (!nextJob) return;

    this.startConversion(nextJob);
  }

  cancelJob(jobId) {
    const job = jobService.getJob(jobId);
    if (!job) return false;

    console.log(`QueueService: Cancelling job ${jobId}, status: ${job.status}`);

    if (job.status === 'processing') {
      // Mark as cancelled immediately to stop progress updates
      job.status = 'cancelled';

      if (job.process) {
        // Handle child process (ffmpeg or node)
        // Check if it's a child_process object (spawn) which has .pid
        console.log(`QueueService: Killing process ${job.process.pid}`);
        try {
          process.kill(job.process.pid, 'SIGKILL');
        } catch (e) {
          console.error(`QueueService: Failed to kill process ${job.process.pid}:`, e);
        }
      }
      // The Service close handler will eventually be called
      return true;
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
      if (job.inputPath) {
        fs.unlink(job.inputPath, () => {});
      }
      return true;
    }

    return false;
  }

  startConversion(job) {
    this.isConverting = true;
    job.status = 'processing';

    socketHandler.emitToClient(job.clientId, 'status_change', { id: job.id, status: 'processing' });

    const onProgress = (progress) => {
        if (job.status === 'cancelled') return;
        job.progress = progress;
        socketHandler.emitToClient(job.clientId, 'progress', { id: job.id, progress });
    };

    const onComplete = (url, ratio) => {
        if (job.status === 'cancelled') {
           this.isConverting = false;
           this.processQueue();
           return;
        }
        this.isConverting = false;
        job.status = 'completed';
        job.progress = 100;
        job.url = url;
        job.compressionRatio = ratio;
        console.log(`Job completed. Ratio: ${ratio}%`);
        socketHandler.emitToClient(job.clientId, 'complete', { id: job.id, url, compressionRatio: ratio });
        this.processQueue();
    };

    const onError = (errorType, message) => {
        this.isConverting = false;
        if (errorType === 'cancelled' || job.status === 'cancelled') {
          job.status = 'cancelled';
          console.log('Job cancelled');
        } else {
          job.status = 'error';
          job.error = 'Обработка не удалась';
          socketHandler.emitToClient(job.clientId, 'error', { id: job.id, message: 'Обработка не удалась' });
        }
        this.processQueue();
    };

    if (job.mode === 'transcription') {
        transcriptionService.transcribe(job, onProgress, onComplete, onError);
    } else {
        ffmpegService.convert(job, onProgress, onComplete, onError);
    }
  }
}

module.exports = new QueueService();

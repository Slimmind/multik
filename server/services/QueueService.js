const jobService = require('./JobService');
const ffmpegService = require('./FFmpegService');
const socketHandler = require('../socket/SocketHandler');

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

  startConversion(job) {
    this.isConverting = true;
    job.status = 'processing';

    socketHandler.emitToClient(job.clientId, 'status_change', { id: job.id, status: 'processing' });

    ffmpegService.convert(
      job,
      (progress) => {
        job.progress = progress;
        socketHandler.emitToClient(job.clientId, 'progress', { id: job.id, progress });
      },
      (url, ratio) => {
        this.isConverting = false;
        job.status = 'completed';
        job.progress = 100;
        job.url = url;
        job.compressionRatio = ratio;
        console.log(`Conversion completed. Ratio: ${ratio}%`);
        socketHandler.emitToClient(job.clientId, 'complete', { id: job.id, url, compressionRatio: ratio });
        this.processQueue();
      },
      (errorType, message) => {
        this.isConverting = false;
        if (errorType === 'cancelled') {
          job.status = 'cancelled';
          console.log('Conversion cancelled');
        } else {
          job.status = 'error';
          job.error = 'Конвертация не удалась';
          socketHandler.emitToClient(job.clientId, 'error', { id: job.id, message: 'Конвертация не удалась' });
        }
        this.processQueue();
      }
    );
  }
}

module.exports = new QueueService();

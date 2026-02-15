import jobService from './JobService.ts';
import ffmpegService from './FFmpegService.ts';
import transcriptionService from './TranscriptionService.ts';
import socketHandler from '../socket/SocketHandler.ts';
import fs from 'fs';

class QueueService {
  private isConverting: boolean;

  constructor() {
    this.isConverting = false;
  }

  processQueue(): void {
    if (this.isConverting) return;

    const nextJob = jobService.getNextQueuedJob();
    if (!nextJob) return;

    this.startConversion(nextJob);
  }

  cancelJob(jobId: string): boolean {
    const job = jobService.getJob(jobId);
    if (!job) return false;

    console.log(`QueueService: Cancelling job ${jobId}, status: ${job.status}`);

    if (job.status === 'processing') {
      job.status = 'cancelled';

      if (job.process) {
        console.log(`QueueService: Killing process for job ${job.id}`);
        try {
            if (typeof job.process.kill === 'function') {
                job.process.kill('SIGKILL');
            } else if (job.process.pid) {
                process.kill(job.process.pid, 'SIGKILL');
            }
        } catch (e) {
          console.error(`QueueService: Failed to kill process:`, e);
        }
      }
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

  private startConversion(job: any): void {
    this.isConverting = true;
    job.status = 'processing';
    job.startTime = Date.now();

    socketHandler.emitToClient(job.clientId, 'status_change', { id: job.id, status: 'processing' });

    const onProgress = (progress: number) => {
        if (job.status === 'cancelled') return;
        job.progress = progress;
        socketHandler.emitToClient(job.clientId, 'progress', { id: job.id, progress });
    };

    const onComplete = (url: string, ratio: number | null) => {
        if (job.status === 'cancelled') {
           this.isConverting = false;
           this.processQueue();
           return;
        }
        this.isConverting = false;
        job.status = 'completed';
        job.progress = 100;
        job.url = url;
        job.compressionRatio = ratio || 0;
        job.endTime = Date.now();

        let duration: string | null = null;
        if (job.startTime) {
            const ms = job.endTime - job.startTime;
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const pad = (num: number) => num.toString().padStart(2, '0');
            duration = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
            job.duration = duration;
        }

        console.log(`Job completed. Ratio: ${ratio}% Duration: ${duration}`);
        socketHandler.emitToClient(job.clientId, 'complete', {
            id: job.id,
            url,
            compressionRatio: ratio,
            duration
        });
        this.processQueue();
    };

    const onError = (errorType: string, message?: string) => {
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

    const onStatus = (status: string) => {
        if (job.status === 'cancelled') return;
        socketHandler.emitToClient(job.clientId, 'status_change', {
            id: job.id,
            status: 'processing',
            subStatus: status
        });
    };

    try {
        if (job.mode === 'transcription') {
            transcriptionService.transcribe(job, onProgress, onComplete, onError, onStatus);
        } else {
            ffmpegService.convert(job, onProgress, onComplete, onError);
        }
    } catch (e) {
        console.error(`Failed to start job ${job.id}:`, e);
        this.isConverting = false;
        job.status = 'error';
        job.error = 'Сбой запуска';
        socketHandler.emitToClient(job.clientId, 'error', { id: job.id, message: 'Сбой запуска обработки' });
        this.processQueue();
    }
  }
}

export default new QueueService();

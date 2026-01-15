import fs from 'fs';
import path from 'path';

class JobService {
  constructor() {
    this.jobs = new Map();
  }

  createJob(id, clientId, file, mode = 'video', encodingMode = 'hardware') {
    const job = {
      id,
      clientId,
      filename: file.originalname,
      inputPath: file.path,
      originalSize: file.size,
      status: 'queued',
      progress: 0,
      process: null,
      thumbnail: null,
      url: null,
      error: null,
      compressionRatio: null,
      mode,
      encodingMode,
      startTime: null,
      endTime: null,
      duration: null
    };
    this.jobs.set(id, job);
    return job;
  }

  createJobFromPath(id, clientId, filePath, mode = 'transcription') {
    const stats = fs.statSync(filePath);
    const job = {
      id,
      clientId,
      filename: path.basename(filePath),
      inputPath: filePath,
      originalSize: stats.size,
      status: 'queued',
      progress: 0,
      process: null,
      thumbnail: null,
      url: null,
      error: null,
      compressionRatio: null,
      mode,
      startTime: null,
      endTime: null,
      duration: null
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  deleteJob(id) {
    return this.jobs.delete(id);
  }

  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  getUserJobs(clientId) {
    return this.getAllJobs().filter(job => job.clientId === clientId);
  }

  getNextQueuedJob() {
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') {
        return job;
      }
    }
    return null;
  }
}

export default new JobService();

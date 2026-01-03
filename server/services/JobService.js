class JobService {
  constructor() {
    this.jobs = new Map();
  }

  createJob(id, clientId, file, mode = 'video') {
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
      mode
    };
    this.jobs.set(id, job);
    return job;
  }

  createJobFromPath(id, clientId, filePath, mode = 'transcription') {
    const fs = require('fs');
    const path = require('path');
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
      mode
    };
    this.jobs.set(id, job);
    return job;
  }

  createJobFromUrl(id, clientId, url, mode = 'youtube') {
    const job = {
      id,
      clientId,
      filename: `Download ${url}`, // Temporary name until resolved
      inputPath: null,
      originalSize: 0,
      status: 'queued',
      progress: 0,
      process: null,
      thumbnail: null,
      url: url, // Source URL
      error: null,
      compressionRatio: null,
      mode
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

module.exports = new JobService();

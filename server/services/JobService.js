import fs from 'fs';
import path from 'path';
import { readdir } from 'node:fs/promises';

const JOBS_FILE = path.resolve('jobs.json');
const OUTPUT_DIR = path.resolve('output');

class JobService {
  constructor() {
    this.jobs = new Map();
    this.loadJobs();
    this.scanOutputDirectory();

    // Save jobs periodically to avoid performance hit on every update
    setInterval(() => this.saveJobs(), 5000);
  }

  loadJobs() {
    try {
      if (fs.existsSync(JOBS_FILE)) {
        const data = fs.readFileSync(JOBS_FILE, 'utf8');
        const jobsArray = JSON.parse(data);
        let validJobsCount = 0;
        let prunedCount = 0;

        jobsArray.forEach(job => {
            // Check if file exists for completed/recovered jobs
            // For queued/processing jobs, inputPath should exist.
            // For completed jobs, we might care about the output (url points to it) or input.
            // 'recovered' jobs rely on inputPath which is the file in output dir.

            let isValid = true;

            // If it's a recovered job or completed, the file it points to should exist
            if (job.status === 'completed' || job.clientId === 'recovered') {
                // For recovered jobs, inputPath is the file in output
                // For normal completed jobs, we might check inputPath or just assume consistency?
                // Let's be safe and check inputPath if it looks like a local file
                if (job.inputPath && !fs.existsSync(job.inputPath)) {
                    isValid = false;
                }
            } else if (job.status === 'queued') {
                 if (job.inputPath && !fs.existsSync(job.inputPath)) {
                    isValid = false;
                    // Alternatively, we could mark it as failed? But pruning is cleaner for "phantom" jobs.
                 }
            }

            if (isValid) {
                this.jobs.set(job.id, job);
                validJobsCount++;
            } else {
                prunedCount++;
            }
        });

        console.log(`Loaded ${validJobsCount} jobs from storage.`);
        if (prunedCount > 0) {
            console.log(`Pruned ${prunedCount} invalid jobs (files missing).`);
            this.saveJobs();
        }
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }
  }

  saveJobs() {
    try {
      const jobsArray = Array.from(this.jobs.values()).map(job => {
         // Create a copy to avoid circular references if any (e.g. process object)
         const { process, ...jobData } = job;
         return jobData;
      });
      fs.writeFileSync(JOBS_FILE, JSON.stringify(jobsArray, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save jobs:', e);
    }
  }

  async scanOutputDirectory() {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) return;

        const files = await readdir(OUTPUT_DIR);
        let recoveredCount = 0;

        for (const file of files) {
            // Skip hidden files or system files
            if (file.startsWith('.')) continue;

            const filePath = path.join(OUTPUT_DIR, file);
            const ext = path.extname(file).toLowerCase();
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
            const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
            const isText = ['.txt', '.srt', '.vtt', '.json', '.md'].includes(ext);
            const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext); // Thumbnails

            if (!isVideo && !isAudio && !isText) continue;

            // Check if this file is already associated with a job (as output url or input path)
            // Note: Job URLs are like '/output/filename.mp4'
            const relativeUrl = `/output/${file}`;
            const exists = Array.from(this.jobs.values()).some(job =>
                job.url === relativeUrl || (job.thumbnail === relativeUrl)
            );

            if (!exists) {
                // Create a recovered job
                const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const stats = fs.statSync(filePath);

                const job = {
                    id,
                    clientId: 'recovered', // Visible to all
                    filename: file,
                    inputPath: filePath, // Existing output is now the input for this "job" entry
                    originalSize: stats.size,
                    status: 'completed',
                    progress: 100,
                    process: null,
                    thumbnail: null,
                    url: relativeUrl,
                    error: null,
                    compressionRatio: null,
                    mode: isAudio ? 'audio' : (isText ? 'transcription' : 'video'),
                    encodingMode: 'software', // Unknown, assumption
                    startTime: stats.birthtimeMs,
                    endTime: stats.mtimeMs,
                    duration: null,
                    fetchedText: false
                };

                // Try to find corresponding thumbnail if video
                if (isVideo) {
                    const thumbName = `thumb-${path.parse(file).name}.jpg`; // Try to guess based on ID pattern or just generic?
                    // Actually, we don't know the original ID if it was lost.
                    // But if we just look for *any* jpg that isn't mapped...
                    // For now, let's just leave thumbnail null or try to generate one?
                    // Generating one might be heavy on startup. Let's skip for now.
                }

                this.jobs.set(id, job);
                recoveredCount++;
            }
        }

        if (recoveredCount > 0) {
            console.log(`Recovered ${recoveredCount} files from output directory.`);
            this.saveJobs();
        }

    } catch (e) {
        console.error('Failed to scan output directory:', e);
    }
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
    this.saveJobs(); // Save immediately on creation
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
    this.saveJobs(); // Save immediately
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  deleteJob(id) {
    const result = this.jobs.delete(id);
    if (result) this.saveJobs(); // Save on delete
    return result;
  }

  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  getUserJobs(clientId) {
    // Return jobs for this client OR recovered jobs
    return this.getAllJobs().filter(job => job.clientId === clientId || job.clientId === 'recovered');
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

import fs from 'fs';
import path from 'path';
import { readdir } from 'node:fs/promises';
import config from '../config.ts';
import type { Job, JobStatus, JobMode, EncodingMode } from '../../src/types.ts';

const JOBS_FILE = path.resolve('jobs.json');
const OUTPUT_DIR = path.resolve(config.dirs.output);

interface ExtendedJob extends Job {
  clientId: string;
  inputPath: string;
  originalSize: number;
  process: any;
}

class JobService {
  private jobs: Map<string, ExtendedJob>;

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
        const jobsArray: ExtendedJob[] = JSON.parse(data);
        let validJobsCount = 0;
        let prunedCount = 0;

        jobsArray.forEach(job => {
            let isValid = true;

            if (job.status === 'completed' || job.clientId === 'recovered') {
                if (job.inputPath && !fs.existsSync(job.inputPath)) {
                    isValid = false;
                }
            } else if (job.status === 'queued') {
                 if (job.inputPath && !fs.existsSync(job.inputPath)) {
                    isValid = false;
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
            if (file.startsWith('.')) continue;

            const filePath = path.join(OUTPUT_DIR, file);
            const ext = path.extname(file).toLowerCase();
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
            const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
            const isText = ['.txt', '.srt', '.vtt', '.json', '.md'].includes(ext);

            if (!isVideo && !isAudio && !isText) continue;

            const relativeUrl = `/output/${file}`;
            const exists = Array.from(this.jobs.values()).some(job =>
                job.url === relativeUrl || (job.thumbnail === relativeUrl)
            );

            if (!exists) {
                const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const stats = fs.statSync(filePath);

                const job: ExtendedJob = {
                    id,
                    clientId: 'recovered',
                    filename: file,
                    inputPath: filePath,
                    originalSize: stats.size,
                    status: 'completed',
                    progress: 100,
                    process: null,
                    thumbnail: null,
                    url: relativeUrl,
                    error: null,
                    compressionRatio: 0,
                    mode: isAudio ? 'audio' : (isText ? 'transcription' : 'video'),
                    encodingMode: 'software',
                    startTime: stats.birthtimeMs,
                    endTime: stats.mtimeMs,
                    conversionDuration: 0,
                    transcriptionText: '',
                    fetchedText: false
                };

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

  createJob(id: string, clientId: string, file: any, mode: JobMode = 'video', encodingMode: EncodingMode = 'hardware'): ExtendedJob {
    const job: ExtendedJob = {
      id,
      clientId,
      filename: file.originalname,
      inputPath: file.path,
      originalSize: file.size,
      status: 'queued',
      progress: 0,
      process: null,
      thumbnail: null,
      url: undefined,
      error: null,
      compressionRatio: 0,
      mode,
      encodingMode,
      startTime: undefined,
      endTime: undefined,
      conversionDuration: 0,
      transcriptionText: undefined,
      fetchedText: false
    };
    this.jobs.set(id, job);
    this.saveJobs();
    return job;
  }

  createJobFromPath(id: string, clientId: string, filePath: string, mode: JobMode = 'transcription'): ExtendedJob {
    const stats = fs.statSync(filePath);
    const job: ExtendedJob = {
      id,
      clientId,
      filename: path.basename(filePath),
      inputPath: filePath,
      originalSize: stats.size,
      status: 'queued',
      progress: 0,
      process: null,
      thumbnail: null,
      url: undefined,
      error: null,
      compressionRatio: 0,
      mode,
      startTime: undefined,
      endTime: undefined,
      conversionDuration: 0,
      transcriptionText: undefined,
      fetchedText: false
    };
    this.jobs.set(id, job);
    this.saveJobs();
    return job;
  }

  getJob(id: string): ExtendedJob | undefined {
    return this.jobs.get(id);
  }

  deleteJob(id: string): boolean {
    const result = this.jobs.delete(id);
    if (result) this.saveJobs();
    return result;
  }

  getAllJobs(): ExtendedJob[] {
    return Array.from(this.jobs.values());
  }

  getUserJobs(clientId: string): ExtendedJob[] {
    return this.getAllJobs().filter(job => job.clientId === clientId || job.clientId === 'recovered');
  }

  getNextQueuedJob(): ExtendedJob | null {
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') {
        return job;
      }
    }
    return null;
  }
}

export default new JobService();

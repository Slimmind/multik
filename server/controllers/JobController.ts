import path from 'path';
import { unlink } from 'node:fs/promises';
import type { Request, Response } from 'express';
import jobService from '../services/JobService.ts';
import ffmpegService from '../services/FFmpegService.ts';
import queueService from '../services/QueueService.ts';
import socketHandler from '../socket/SocketHandler.ts';
import config from '../config.ts';

class JobController {
  getJobs(req: Request, res: Response): void {
    const { clientId } = req.params;
    const userJobs = jobService.getUserJobs(clientId).map(job => ({
      id: job.id,
      filename: job.filename,
      status: job.status,
      progress: job.progress,
      url: job.url,
      error: job.error,
      compressionRatio: job.compressionRatio,
      thumbnail: job.thumbnail,
      mode: job.mode || 'video',
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.duration
    }));
    res.json(userJobs);
  }

  upload(req: Request, res: Response): void {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Нет файла' });
            return;
        }

        const clientId = req.body.clientId;
        const jobId = req.body.jobId;
        const mode = req.body.mode || 'video';
        const encodingMode = req.body.encodingMode || 'hardware';

        if (!clientId || !jobId) {
            res.status(400).json({ error: 'Нет clientId или jobId' });
            return;
        }

        const job = jobService.createJob(jobId, clientId, req.file, mode, encodingMode);
        res.json({ status: 'queued' });

        if (mode === 'video') {
          ffmpegService.generateThumbnail(job, (err, url) => {
            if (!err && url) {
              job.thumbnail = url;
              socketHandler.emitToClient(clientId, 'thumbnail', { id: jobId, url });
              console.log(`Thumbnail generated for ${jobId}`);
            } else {
              console.error(`Thumbnail generation failed for ${jobId}:`, err);
            }
          });
        }

        queueService.processQueue();
    } catch (e: any) {
        console.error('Upload error:', e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error during upload', details: e.message });
        }
    }
  }

  cancel(req: Request, res: Response): void {
    const { jobId } = req.body;
    if (!jobId) {
        res.status(400).json({ error: 'Нет jobId' });
        return;
    }

    const result = queueService.cancelJob(jobId);
    if (result) {
      res.json({ status: 'cancelled' });
      return;
    }

    const job = jobService.getJob(jobId);
    if (job) {
      res.json({ status: job.status });
      return;
    }

    res.status(404).json({ error: 'Процесс не найден' });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { jobId } = req.body;
    if (!jobId) {
        res.status(400).json({ error: 'Нет jobId' });
        return;
    }

    const job = jobService.getJob(jobId);
    if (job) {
      console.log(`Deleting job ${jobId}`);

      jobService.deleteJob(jobId);

      const safeUnlink = async (filePath: string | undefined | null, type: string) => {
        if (!filePath) return;
        const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath.startsWith('/') ? '.' + filePath : filePath);

        try {
            if (await Bun.file(targetPath).exists()) {
                await unlink(targetPath);
                console.log(`Deleted ${type}: ${targetPath}`);
            }
        } catch(e) {
             console.error(`Error deleting ${type}:`, e);
        }
      };

      await safeUnlink(job.url, 'output file');
      await safeUnlink(job.thumbnail, 'thumbnail');
      await safeUnlink(job.inputPath, 'input file');

      res.json({ status: 'deleted' });
      return;
    }

    res.status(404).json({ error: 'Задание не найдено' });
  }

  async transcribe(req: Request, res: Response): Promise<void> {
    const { jobId, audioUrl, clientId } = req.body;
    if (!jobId || !audioUrl || !clientId) {
      res.status(400).json({ error: 'Нет jobId, audioUrl или clientId' });
      return;
    }

    const audioPath = path.resolve('.' + audioUrl);

    if (!(await Bun.file(audioPath).exists())) {
      res.status(404).json({ error: 'Аудиофайл не найден' });
      return;
    }

    const job = jobService.createJobFromPath(jobId, clientId, audioPath, 'transcription');
    res.json({ status: 'queued' });

    queueService.processQueue();
  }

  async correctText(req: Request, res: Response): Promise<void> {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Нет текста для обработки' });
      return;
    }

    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      res.status(500).json({ error: 'API ключ не настроен' });
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${apiKey}`,
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
        res.status(500).json({ error: 'Ошибка API' });
        return;
      }

      const data: any = await response.json();
      const correctedText = data.candidates?.[0]?.content?.parts?.[0]?.text || text;

      res.json({ correctedText });
    } catch (e) {
      console.error('AI correction error:', e);
      res.status(500).json({ error: 'Ошибка обработки' });
    }
  }
}

export default new JobController();

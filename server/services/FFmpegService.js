import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class FFmpegService {
  timeToSeconds(timeStr) {
    const [h, m, s] = timeStr.split(':').map(parseFloat);
    return h * 3600 + m * 60 + s;
  }

  generateThumbnail(job, callback) {
    const thumbnailName = `thumb-${job.id}.jpg`;
    const outputDir = path.resolve('output');
    const thumbnailPath = path.join(outputDir, thumbnailName);
    const inputPath = path.resolve(job.inputPath);

    console.log(`Generating thumbnail. Input: ${inputPath}, Output: ${thumbnailPath}`);

    const thumbProc = spawn('ffmpeg', [
      '-ss', '00:00:00.500',
      '-i', inputPath,
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      '-q:v', '2',
      '-y',
      thumbnailPath
    ]);

    let thumbError = '';
    thumbProc.stderr.on('data', (data) => {
      thumbError += data.toString();
    });

    thumbProc.on('close', (code) => {
      if (code === 0) {
        if (fs.existsSync(thumbnailPath)) {
          const url = `/output/${thumbnailName}`;
          console.log(`[FFmpeg] Thumbnail generated: ${url}`);
          callback(null, url);
        } else {
          console.error(`[FFmpeg] Thumbnail file not found after success exit: ${thumbnailPath}`);
          callback(new Error('Thumbnail file creation failed'));
        }
      } else {
        console.error(`[FFmpeg] Thumbnail failed (Code ${code}). Command: ffmpeg -ss 0.5 -i ${inputPath} ...`);
        console.error(`[FFmpeg] Stderr: ${thumbError}`);
        callback(new Error(thumbError));
      }
    });
  }

  convert(job, onProgress, onComplete, onError) {
    const originalName = path.parse(job.filename).name;
    const extension = job.mode === 'audio' ? '.mp3' : '.mp4';
    const outputFile = path.join('output', `${originalName}${extension}`);

    console.log(`Starting conversion for job ${job.id}, file: ${job.inputPath}`);

    const ffmpegArgs = ['-threads', '2', '-i', job.inputPath];

    if (job.mode === 'audio') {
      ffmpegArgs.push(
        '-vn',
        '-c:a', 'libmp3lame',
        '-q:a', '2'
      );
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-threads', '2',
        '-x264-params', 'threads=2',
        '-c:a', 'aac'
      );
    }

    ffmpegArgs.push('-y', outputFile);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    job.process = ffmpeg;

    let duration = null;
    let lastProgress = -1;
    let buffer = '';
    let stderrLog = [];
    const MAX_LOG_LINES = 50;

    ffmpeg.stderr.on('data', (data) => {
      if (job.status === 'cancelled') {
        if (!ffmpeg.killed) {
          console.log(`FFmpegService: Job ${job.id} is cancelled. Killing process ${ffmpeg.pid}`);
          ffmpeg.kill('SIGKILL');
        }
        return;
      }

      buffer += data.toString();

      while (true) {
        const nIndex = buffer.indexOf('\n');
        const rIndex = buffer.indexOf('\r');

        if (nIndex === -1 && rIndex === -1) break;

        let splitIndex;
        if (nIndex !== -1 && rIndex !== -1) {
          splitIndex = Math.min(nIndex, rIndex);
        } else {
          splitIndex = (nIndex !== -1) ? nIndex : rIndex;
        }

        const line = buffer.slice(0, splitIndex).trim();

        let nextStart = splitIndex + 1;
        if (buffer[splitIndex] === '\r' && buffer[nextStart] === '\n') {
          nextStart++;
        }

        buffer = buffer.slice(nextStart);

        if (!line) continue;

        if (stderrLog.length > MAX_LOG_LINES) {
          stderrLog.shift();
        }
        stderrLog.push(line);

        if (duration === null) {
          const durMatch = line.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
          if (durMatch) {
            duration = this.timeToSeconds(durMatch[1]);
          }
        }

        if (duration) {
          const timeMatch = line.match(/time=\s*(\d+:\d+:\d+(?:\.\d+)?)/);
          if (timeMatch) {
            const currentTime = this.timeToSeconds(timeMatch[1]);
            const progress = Math.min(99, Math.floor((currentTime / duration) * 100));

            if (progress > lastProgress) {
              lastProgress = progress;
              onProgress(progress);
            }
          }
        }
      }

      if (buffer.length > 2000) {
        buffer = buffer.slice(-1000);
      }
    });

    ffmpeg.on('close', (code, signal) => {
      job.process = null;
      fs.unlink(job.inputPath, () => { });

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        fs.unlink(outputFile, () => { });
        onError('cancelled');
      } else if (code === 0) {
        const url = `/output/${path.basename(outputFile)}`;
        let ratio = 0;
        try {
          // Calculate ratio only for video mode, or if it makes sense.
          // For audio extraction, the size difference is due to format change, not "compression" in the same sense.
          if (job.mode !== 'audio') {
            const newSize = fs.statSync(outputFile).size;
            if (job.originalSize > 0) {
              ratio = Math.round((1 - newSize / job.originalSize) * 100);
            }
          } else {
            ratio = null; // Signal no ratio
          }
        } catch (e) {
          console.error('Error calculating ratio:', e);
        }
        onComplete(url, ratio);
      } else {
        console.error('FFmpeg error:\n', stderrLog.join('\n'));
        onError('failed', stderrLog.join('\n'));
      }
    });
  }
}

export default new FFmpegService();

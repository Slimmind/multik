import { spawn } from 'bun';
import path from 'path';
import { unlink } from 'node:fs/promises';

class FFmpegService {
  timeToSeconds(timeStr) {
    const [h, m, s] = timeStr.split(':').map(parseFloat);
    return h * 3600 + m * 60 + s;
  }

  async generateThumbnail(job, callback) {
    const thumbnailName = `thumb-${job.id}.jpg`;
    const outputDir = path.resolve('output');
    const thumbnailPath = path.join(outputDir, thumbnailName);
    const inputPath = path.resolve(job.inputPath);

    console.log(`Generating thumbnail. Input: ${inputPath}, Output: ${thumbnailPath}`);

    const cmd = [
      'ffmpeg',
      '-ss', '00:00:00.500',
      '-i', inputPath,
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      '-q:v', '2',
      '-y',
      thumbnailPath
    ];

    try {
      const proc = Bun.spawn(cmd, {
        stderr: 'pipe',
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      if (proc.exitCode === 0) {
        if (await Bun.file(thumbnailPath).exists()) {
          const url = `/output/${thumbnailName}`;
          console.log(`[FFmpeg] Thumbnail generated: ${url}`);
          callback(null, url);
        } else {
          console.error(`[FFmpeg] Thumbnail file not found after success exit: ${thumbnailPath}`);
          callback(new Error('Thumbnail file creation failed'));
        }
      } else {
        console.error(`[FFmpeg] Thumbnail failed (Code ${proc.exitCode}). Command: ${cmd.join(' ')}`);
        console.error(`[FFmpeg] Stderr: ${stderr}`);
        callback(new Error(stderr));
      }
    } catch (e) {
      console.error('[FFmpeg] Thumbnail spawn error:', e);
      callback(e);
    }
  }

  async convert(job, onProgress, onComplete, onError) {
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
       if (job.encodingMode === 'software') {
           // Software encoding (CPU)
           ffmpegArgs.push(
               '-c:v', 'libx264',
               '-preset', 'fast',
               '-threads', '2',
               '-x264-params', 'threads=2',
               '-c:a', 'aac'
           );
       } else {
           // Hardware encoding (default)
           ffmpegArgs.push(
            '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p',
            '-pix_fmt', 'yuv420p',
            '-c:v', 'h264_v4l2m2m',
            '-b:v', '10M',
            '-c:a', 'aac'
          );
       }
    }

    ffmpegArgs.push('-y', outputFile);

    const cmd = ['ffmpeg', ...ffmpegArgs];

    try {
      const proc = Bun.spawn(cmd, {
        stderr: 'pipe',
      });

      job.process = proc;

      let duration = null;
      let lastProgress = -1;
      let stderrLog = [];
      const MAX_LOG_LINES = 50;

      // Stream reader logic for stderr
      const reader = proc.stderr.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processOutput = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

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
          }
        } catch (e) {
          console.error('[FFmpeg] Error reading stderr stream:', e);
        }
      };

      // Start processing output but don't await blocking the main flow
      processOutput();

      const exitCode = await proc.exited;
      job.process = null;

      // Wait a bit to ensure all output is processed if needed,
      // though typically await proc.exited handles process termination.

      // Cleanup input file
      try { await unlink(job.inputPath); } catch(e) {}

      if (proc.signalCode === 'SIGKILL' || proc.signalCode === 'SIGTERM') {
          try { await unlink(outputFile); } catch(e) {}
          onError('cancelled');
      } else if (exitCode === 0) {
        const url = `/output/${path.basename(outputFile)}`;
        let ratio = 0;
        try {
          if (job.mode !== 'audio') {
            const newSize = Bun.file(outputFile).size;
            if (job.originalSize > 0) {
              ratio = Math.round((1 - newSize / job.originalSize) * 100);
            }
          } else {
            ratio = null;
          }
        } catch (e) {
          console.error('Error calculating ratio:', e);
        }
        onComplete(url, ratio);
      } else {
        console.error('FFmpeg error:\n', stderrLog.join('\n'));
        onError('failed', stderrLog.join('\n'));
      }

    } catch (e) {
      console.error(`[FFmpeg] Spawn error for job ${job.id}:`, e);
      onError('failed', e.message);
    }
  }
}

export default new FFmpegService();

import { spawn } from 'bun';
import path from 'path';
import { unlink, rename } from 'node:fs/promises';

type ProgressCallback = (progress: number) => void;
type CompleteCallback = (url: string, ratio: number | null) => void;
type ErrorCallback = (type: string, message?: string) => void;
type StatusCallback = (status: string) => void;

class TranscriptionService {
  async transcribe(
    job: any,
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    onStatus: StatusCallback
  ): Promise<void> {
    const originalName = path.parse(job.filename).name;
    const outputFile = path.join('output', `${originalName}.txt`);
    const scriptPath = path.resolve('server/scripts/transcribe.py');

    console.log(`Starting transcription for job ${job.id}, file: ${job.inputPath}`);

    const inputDir = path.dirname(path.resolve(job.inputPath));
    const inputExt = path.extname(job.inputPath);
    const inputBase = path.basename(job.inputPath, inputExt);
    const expectedGeneratedFile = path.join(inputDir, `${inputBase}.txt`);

    const cmd = [
      'python3',
      scriptPath,
      '--file', path.resolve(job.inputPath),
      '--lang', 'ru',
      '--output', expectedGeneratedFile
    ];

    try {
      const proc = Bun.spawn(cmd, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          OMP_NUM_THREADS: '2',
          MKL_NUM_THREADS: '2',
          OPENBLAS_NUM_THREADS: '2'
        }
      });

      job.process = proc;

      let stderrLog: string[] = [];
      let progress = 0;
      let progressInterval: any = null;
      let startTime = 0;
      const PROCESSING_FACTOR = 0.2;

      const startProgressSimulation = (duration: number) => {
        if (progressInterval) clearInterval(progressInterval);

        const estimatedProcessingTime = duration * PROCESSING_FACTOR;
        console.log(`[Transcription] Audio duration: ${duration}s. Estimated processing: ${estimatedProcessingTime}s`);

        startTime = Date.now();

        progressInterval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const calculatedProgress = (elapsed / estimatedProcessingTime) * 95;

          if (calculatedProgress > progress && calculatedProgress <= 95) {
            progress = Math.min(Math.round(calculatedProgress), 95);
            onProgress(progress);
          }
        }, 1000);
      };

      const cleanup = () => {
        if (progressInterval) clearInterval(progressInterval);
        job.process = null;
      };

      const stdoutReader = proc.stdout.getReader();
      const stderrReader = proc.stderr.getReader();
      const decoder = new TextDecoder();

      const processStdout = async () => {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await stdoutReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (let line of lines) {
              line = line.trim();
              if (!line) continue;

              console.log(`[Transcription] ${line}`);

              const durationMatch = line.match(/\[DURATION\]\s+(\d+(\.\d+)?)/);
              if (durationMatch) {
                 const duration = parseFloat(durationMatch[1]);
                 startProgressSimulation(duration);
              }

              const statusMatch = line.match(/\[STATUS\]\s+(.+)/);
              if (statusMatch && onStatus) {
                 const status = statusMatch[1].toLowerCase();
                 onStatus(status);
              }
            }
          }
        } catch (e) {
          console.error('[Transcription] Error reading stdout:', e);
        }
      };

      const processStderr = async () => {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await stderrReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (let str of lines) {
              str = str.trim();
              if(!str) continue;

              stderrLog.push(str);

              if (str.includes('%|') || str.includes('frames/s') || str.includes('it/s')) {
                  continue;
              }

              if (str.toLowerCase().includes('warning')) {
                  console.warn(`[Transcription Warning] ${str}`);
              } else if (str.toLowerCase().includes('error') || str.toLowerCase().includes('traceback')) {
                  console.error(`[Transcription Error] ${str}`);
              } else {
                  console.log(`[Transcription Log] ${str}`);
              }
            }
          }
        } catch (e) {
          console.error('[Transcription] Error reading stderr:', e);
        }
      };

      processStdout();
      processStderr();

      const exitCode = await proc.exited;
      cleanup();

      const isOutputFile = job.inputPath.includes('output');
      if (!isOutputFile) {
        try { await unlink(job.inputPath); } catch (e) {}
      }

      if (proc.signalCode === 'SIGKILL' || proc.signalCode === 'SIGTERM') {
        try { await unlink(expectedGeneratedFile); } catch (e) {}
        onError('cancelled');
        return;
      }

      if (exitCode === 0) {
        if (isOutputFile) {
          if (await Bun.file(expectedGeneratedFile).exists()) {
            const url = `/output/${path.basename(expectedGeneratedFile)}`;
            onComplete(url, null);
          } else {
            console.error('[Transcription] Output file missing');
            onError('failed', 'Файл результата не найден');
          }
        } else {
          try {
            if (await Bun.file(expectedGeneratedFile).exists()) {
                await rename(expectedGeneratedFile, outputFile);
                const url = `/output/${path.basename(outputFile)}`;
                onComplete(url, null);
            } else {
                console.error('[Transcription] Output file missing');
                onError('failed', 'Файл результата не найден');
            }
           } catch(err) {
               console.error('[Transcription] Failed to move output file:', err);
               onError('failed', 'Ошибка сохранения файла');
           }
        }
      } else {
        console.error('[Transcription] Process failed:\n', stderrLog.join('\n'));
        onError('failed', stderrLog.join('\n'));
      }

    } catch (e: any) {
      console.error(`[Transcription] Spawn error:`, e);
      onError('failed', e.message);
    }
  }
}

export default new TranscriptionService();

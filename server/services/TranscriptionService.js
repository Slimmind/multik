const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TranscriptionService {
  transcribe(job, onProgress, onComplete, onError, onStatus) {
    const originalName = path.parse(job.filename).name;
    const outputFile = path.join('output', `${originalName}.txt`);
    const scriptPath = path.resolve('server/scripts/transcribe.py'); // Moved to scripts folder

    console.log(`Starting transcription for job ${job.id}, file: ${job.inputPath}`);

    // Python script saves .txt output next to the input file by default.

    const inputDir = path.dirname(path.resolve(job.inputPath));
    const inputExt = path.extname(job.inputPath);
    const inputBase = path.basename(job.inputPath, inputExt);
    const expectedGeneratedFile = path.join(inputDir, `${inputBase}.txt`);

    // Spawn python3 process
    const nodeCb = spawn('python3', [
      scriptPath,
      '--file', path.resolve(job.inputPath),
      '--lang', 'ru', // Default to Russian for now, or pass from job if available
      '--output', expectedGeneratedFile // Explicitly tell python where to save
    ]);

    job.process = nodeCb;

    let stderrLog = [];

    // Progress simulation
    let progress = 0;
    let progressInterval = null;
    let estimatedDuration = 0;
    let startTime = 0;

    // Processing speed estimation factor (0.2 ~= 5x realtime speed)
    const PROCESSING_FACTOR = 0.2;

    const startProgressSimulation = (duration) => {
      if (progressInterval) clearInterval(progressInterval);

      const estimatedProcessingTime = duration * PROCESSING_FACTOR;

      console.log(`[Transcription] Audio duration: ${duration}s. Estimated processing: ${estimatedProcessingTime}s`);

      startTime = Date.now();

      progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const calculatedProgress = (elapsed / estimatedProcessingTime) * 95;

        // Ensure we don't go backwards or exceed 95%
        if (calculatedProgress > progress && calculatedProgress <= 95) {
          progress = Math.min(Math.round(calculatedProgress), 95);
          onProgress(progress);
        }
      }, 1000);
    };

    // parse stdout line by line to ensure we catch [DURATION] even if chunked
    let stdoutBuffer = '';
    nodeCb.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();

        let lines = stdoutBuffer.split('\n');
        // Keep the last incomplete line in buffer
        stdoutBuffer = lines.pop();

        lines.forEach(line => {
             line = line.trim();
             if (!line) return;

             console.log(`[Transcription] ${line}`);

             // Check for Duration
             const durationMatch = line.match(/\[DURATION\]\s+(\d+(\.\d+)?)/);
             if (durationMatch) {
                 const duration = parseFloat(durationMatch[1]);
                 startProgressSimulation(duration);
             }

             // Check for Status
             const statusMatch = line.match(/\[STATUS\]\s+(.+)/);
             if (statusMatch && onStatus) {
                 const status = statusMatch[1].toLowerCase();
                 onStatus(status);
             }
        });
    });

    nodeCb.stderr.on('data', (data) => {
      const str = data.toString();
      stderrLog.push(str);

      // Filter out tqdm progress bars (often contain percentage or iterations/s)
      if (str.includes('%|') || str.includes('frames/s') || str.includes('it/s')) {
          // It's just progress info from python, ignore or log as info
          return;
      }

      if (str.toLowerCase().includes('warning')) {
          console.warn(`[Transcription Warning] ${str.trim()}`);
      } else if (str.toLowerCase().includes('error') || str.toLowerCase().includes('traceback')) {
          console.error(`[Transcription Error] ${str.trim()}`);
      } else {
          console.log(`[Transcription Log] ${str.trim()}`);
      }
    });

    const cleanup = () => {
      if (progressInterval) clearInterval(progressInterval);
      job.process = null;
    };

    nodeCb.on('close', (code, signal) => {
      cleanup();

      // Don't delete source audio if it's in output folder (it's a completed extraction)
      const isOutputFile = job.inputPath.includes('output');
      if (!isOutputFile) {
        fs.unlink(job.inputPath, () => {}); // Clean up input only if from uploads
      }

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        fs.unlink(expectedGeneratedFile, () => {});
        onError('cancelled');
        return;
      }

      if (code === 0) {
        // If input was already in output folder, the .txt is also there
        // No need to move, just check it exists
        if (isOutputFile) {
          // expectedGeneratedFile is already in output
          if (fs.existsSync(expectedGeneratedFile)) {
            const url = `/output/${path.basename(expectedGeneratedFile)}`;
            onComplete(url, null);
          } else {
            console.error('[Transcription] Output file missing');
            onError('failed', 'Файл результата не найден');
          }
        } else {
          // Move from uploads to output
          if (fs.existsSync(expectedGeneratedFile)) {
               fs.rename(expectedGeneratedFile, outputFile, (err) => {
                   if (err) {
                       console.error('[Transcription] Failed to move output file:', err);
                       onError('failed', 'Ошибка сохранения файла');
                   } else {
                       const url = `/output/${path.basename(outputFile)}`;
                       onComplete(url, null);
                   }
               });
          } else {
              console.error('[Transcription] Output file missing');
              onError('failed', 'Файл результата не найден');
          }
        }
      } else {
        console.error('[Transcription] Process failed:\n', stderrLog.join('\n'));
        onError('failed', stderrLog.join('\n'));
      }
    });
  }
}

module.exports = new TranscriptionService();

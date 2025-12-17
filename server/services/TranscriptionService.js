const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TranscriptionService {
  transcribe(job, onProgress, onComplete, onError) {
    const originalName = path.parse(job.filename).name;
    const outputFile = path.join('output', `${originalName}.txt`);
    const scriptPath = path.resolve('server/scripts/transcribe.mjs');

    console.log(`Starting transcription for job ${job.id}, file: ${job.inputPath}`);

    // Since transcribe.mjs saves .txt in the SAME directory as input,
    // we need to know where it will be saved.
    // transcribe.mjs logic: audio_file.with_suffix(".txt")
    // inputPath is usually 'uploads/filename.ext'.
    // So output will be 'uploads/filename.txt'.
    // We want to move it to 'output/' folder to match FFmpegService behavior.

    const inputDir = path.dirname(path.resolve(job.inputPath));
    const inputExt = path.extname(job.inputPath);
    const inputBase = path.basename(job.inputPath, inputExt);
    const expectedGeneratedFile = path.join(inputDir, `${inputBase}.txt`);

    const nodeCb = spawn('node', [
      scriptPath,
      '--file', path.resolve(job.inputPath)
    ]);

    job.process = nodeCb;

    let stderrLog = [];

    // transcribe.mjs prints to stdout
    nodeCb.stdout.on('data', (data) => {
        const str = data.toString();
        // We could parse logs here if we want to show real progress?
        // But for "small" model on CPU, it blocks main thread of the child process mostly.
        // We can just rely on completion.
        console.log(`[Transcription] ${str.trim()}`);
    });

    nodeCb.stderr.on('data', (data) => {
      const str = data.toString();
      stderrLog.push(str);
      // Transformers.js logs loading info to stderr sometimes or just warnings
      console.error(`[Transcription Error] ${str.trim()}`);
    });

    // Progress simulation
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += 5;
            onProgress(progress);
        }
    }, 2000);

    const cleanup = () => {
      clearInterval(progressInterval);
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

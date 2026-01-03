const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class YoutubeService {
  download(job, onProgress, onComplete, onError, onStatus) {
    const scriptPath = path.resolve(__dirname, '../scripts/download_youtube.py');
    const outputPath = path.join('output', `youtube_${job.id}.mp4`);
    const absoluteOutputPath = path.resolve(outputPath);

    console.log(`Starting YouTube download for job ${job.id}, url: ${job.url}`);

    const nodeCb = spawn('python3', [
      scriptPath,
      '--url', job.url,
      '--output', absoluteOutputPath
    ]);

    job.process = nodeCb;
    let stderrLog = [];

    nodeCb.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Parse Progress
        // [PROGRESS] 45.5
        const progressMatch = line.match(/\[PROGRESS\]\s+(\d+(\.\d+)?)/);
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          onProgress(percent);
        }

        // Parse Status
        const statusMatch = line.match(/\[STATUS\]\s+(.+)/);
        if (statusMatch && onStatus) {
          onStatus(statusMatch[1]);
        }

        // Log Info
        if (line.includes('[INFO]') || line.includes('[RESULT]')) {
             console.log(`[Youtube] ${line}`);
        }
      });
    });

    nodeCb.stderr.on('data', (data) => {
      const str = data.toString();
      stderrLog.push(str);
      console.error(`[Youtube Error] ${str}`);
    });

    const cleanup = () => {
      job.process = null;
    };

    nodeCb.on('close', (code, signal) => {
      cleanup();

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        // cleanup file
        fs.unlink(absoluteOutputPath, () => {});
        onError('cancelled');
        return;
      }

      if (code === 0) {
        if (fs.existsSync(absoluteOutputPath)) {
             const url = `/output/${path.basename(outputPath)}`;
             onComplete(url, null); // null for thumbnail initially, maybe python can return it?
             // Actually, the python script prints [INFO] Thumbnail: ...
             // We could capture it, but for now let's just finish the file flow.
        } else {
             onError('failed', 'Файл не найден');
        }
      } else {
        onError('failed', stderrLog.join('\n') || 'Unknown error');
      }
    });
  }
}

module.exports = new YoutubeService();

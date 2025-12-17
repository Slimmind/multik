import { JobRenderer } from '../ui/JobRenderer.js';

export class JobManager {
  constructor(apiService, socketService) {
    this.api = apiService;
    this.socket = socketService;

    this.renderer = new JobRenderer({
      video: document.getElementById('fileList-video'),
      audio: document.getElementById('fileList-audio'),
      transcription: document.getElementById('fileList-transcription')
    }, {
      onCancel: (id) => this.cancelJob(id),
      onRetry: (id) => this.retryJob(id),
      onDelete: (id) => this.deleteJob(id),
      onTranscribe: (id, audioUrl) => this.queueTranscription(id, audioUrl)
    });

    this.uploadQueue = [];
    this.isUploading = false;
    this.allFiles = new Map();
    this.transcriptionQueue = [];

    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.socket.connect();

    this.socket.on('status_change', (data) => {
      if (data.status === 'processing') {
        const fileObj = this.allFiles.get(data.id);
        const statusText = fileObj?.mode === 'transcription'
          ? 'Транскрибация... 0%'
          : (fileObj?.mode === 'audio' ? 'Экстракция аудио... 0%' : 'Конвертация... 0%');
        this.renderer.updateStatus(data.id, 'processing', statusText);
        this.renderer.moveToTop(data.id, fileObj?.mode);
      }
    });

    this.socket.on('progress', (data) => {
      const fileObj = this.allFiles.get(data.id);
      this.renderer.updateProgress(data.id, data.progress, fileObj?.mode);
    });

    this.socket.on('complete', (data) => {
      const fileObj = this.allFiles.get(data.id);
      this.renderer.markCompleted(data.id, data.url, data.compressionRatio, fileObj?.mode);
    });

    this.socket.on('error', (data) => {
      this.renderer.markError(data.id, data.message);
    });

    this.socket.on('thumbnail', (data) => {
      this.renderer.setThumbnail(data.id, data.url);
    });
  }

  async restoreState() {
    try {
      const jobs = await this.api.getJobs();
      jobs.forEach(job => {
        const fileObj = {
          id: job.id,
          file: { name: job.filename },
          status: job.status,
          mode: job.mode || 'video',
          size: job.size || 0,
          restored: true
        };
        this.allFiles.set(job.id, fileObj);
        this.renderer.createFileItem(fileObj);

        if (job.thumbnail) {
          this.renderer.setThumbnail(job.id, job.thumbnail);
        }

        if (job.status === 'queued') {
          this.renderer.updateStatus(job.id, 'pending', 'В очереди на обработку');
          document.querySelector(`#${job.id} .cancel-btn`).style.display = 'inline-block';
        } else if (job.status === 'processing') {
          this.renderer.updateProgress(job.id, job.progress, job.mode);
          this.renderer.moveToTop(job.id, job.mode);
          document.querySelector(`#${job.id} .cancel-btn`).style.display = 'inline-block';
        } else if (job.status === 'completed') {
          this.renderer.markCompleted(job.id, job.url, job.compressionRatio, job.mode);
        } else if (job.status === 'error') {
          this.renderer.markError(job.id, job.error);
        } else if (job.status === 'cancelled') {
          this.renderer.updateStatus(job.id, 'error', 'Отменено');
          document.querySelector(`#${job.id} .delete-btn`).style.display = 'inline-flex';
        }
      });
    } catch (e) {
      console.error('Failed to restore jobs', e);
    }
  }

  addFiles(files, mode) {
    const newFiles = Array.from(files).map(file => {
      const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      return { id, file, status: 'pending', size: file.size, mode };
    });

    newFiles.sort((a, b) => a.size - b.size);

    newFiles.forEach(fileObj => {
      this.allFiles.set(fileObj.id, fileObj);
      this.uploadQueue.push(fileObj);
      this.renderer.createFileItem(fileObj);
    });

    this.processUploadQueue();
  }

  queueTranscription(sourceJobId, audioUrl) {
    const sourceJob = this.allFiles.get(sourceJobId);
    if (!sourceJob) return;

    // Create a new transcription job linked to the audio output
    const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const transcriptionJob = {
      id,
      file: { name: sourceJob.file.name.replace(/\.[^/.]+$/, '.txt') },
      status: 'pending',
      size: sourceJob.size || 0,
      mode: 'transcription',
      sourceAudioUrl: audioUrl,
      restored: false
    };

    this.allFiles.set(id, transcriptionJob);
    this.transcriptionQueue.push(transcriptionJob);

    // Sort by size (ascending)
    this.transcriptionQueue.sort((a, b) => a.size - b.size);

    // Create UI item
    this.renderer.createFileItem(transcriptionJob);

    // Re-sort DOM elements to match queue order
    this.sortTranscriptionList();

    // Auto-start if this is the only/first item and nothing is uploading
    if (this.transcriptionQueue.length === 1) {
      this.processTranscriptionQueue();
    }
  }

  sortTranscriptionList() {
    const list = document.getElementById('fileList-transcription');
    const items = Array.from(list.children);
    items.sort((a, b) => {
      const sizeA = parseInt(a.dataset.size) || 0;
      const sizeB = parseInt(b.dataset.size) || 0;
      return sizeA - sizeB;
    });
    items.forEach(item => list.appendChild(item));
  }

  async processTranscriptionQueue() {
    if (this.transcriptionQueue.length === 0) return;

    const job = this.transcriptionQueue[0];
    if (job.status !== 'pending') return;

    // Upload to server for transcription
    // The source audio is already on the server at job.sourceAudioUrl (e.g., /output/file.mp3)
    // We need a new API endpoint or reuse upload with special handling
    // For now, we'll use the existing upload mechanism but with the audio URL

    this.renderer.updateStatus(job.id, 'pending', 'Запуск транскрибации...');

    try {
      // Call API to start transcription from existing file
      const response = await this.api.startTranscription(job.id, job.sourceAudioUrl);
      if (response.status === 'queued') {
        this.renderer.updateStatus(job.id, 'pending', 'В очереди на транскрибацию');
        document.querySelector(`#${job.id} .cancel-btn`).style.display = 'inline-block';
      }
    } catch (e) {
      console.error('Failed to start transcription:', e);
      this.renderer.markError(job.id, 'Ошибка запуска');
      this.transcriptionQueue.shift();
      this.processTranscriptionQueue();
    }
  }

  async processUploadQueue() {
    if (this.isUploading || this.uploadQueue.length === 0) return;

    this.isUploading = true;
    const currentFile = this.uploadQueue[0];

    if (!document.getElementById(currentFile.id)) {
      this.uploadQueue.shift();
      this.isUploading = false;
      this.processUploadQueue();
      return;
    }

    this.renderer.setUploading(currentFile.id);

    const xhr = this.api.uploadFile(
      currentFile.file,
      currentFile.id,
      currentFile.mode,
      (percent) => this.renderer.updateUploadProgress(currentFile.id, percent),
      () => {
        this.renderer.updateStatus(currentFile.id, 'pending', 'В очереди на обработку');
        document.querySelector(`#${currentFile.id} .progress-bar`).classList.remove('uploading');
        document.querySelector(`#${currentFile.id} .progress-bar`).style.width = '0%';

        currentFile.xhr = null;

        this.uploadQueue.shift();
        this.isUploading = false;
        this.processUploadQueue();
      },
      (errorMsg) => {
        this.renderer.markError(currentFile.id, errorMsg);
        currentFile.xhr = null;
        this.uploadQueue.shift();
        this.isUploading = false;
        this.processUploadQueue();
      }
    );

    currentFile.xhr = xhr;
  }

  async cancelJob(id) {
    const fileObj = this.allFiles.get(id);
    if (fileObj && fileObj.xhr) {
      fileObj.xhr.abort();
      fileObj.xhr = null;
      this.renderer.markError(id, 'Загрузка отменена');

      const idx = this.uploadQueue.findIndex(f => f.id === id);
      if (idx !== -1) {
        this.uploadQueue.splice(idx, 1);
      }
      if (this.isUploading) {
        this.isUploading = false;
        this.processUploadQueue();
      }
      return;
    }

    this.renderer.updateStatus(id, 'error', 'Отменено');
    document.querySelector(`#${id} .cancel-btn`).style.display = 'none';

    if (fileObj && !fileObj.restored) {
      document.querySelector(`#${id} .retry-btn`).style.display = 'inline-block';
    }
    document.querySelector(`#${id} .delete-btn`).style.display = 'inline-flex';
    document.querySelector(`#${id} .progress-bar`).style.width = '0%';
    document.querySelector(`#${id} .progress-bar`).classList.add('error');

    const idx = this.uploadQueue.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.uploadQueue.splice(idx, 1);
    }

    // Also remove from transcription queue if present
    const tIdx = this.transcriptionQueue.findIndex(f => f.id === id);
    if (tIdx !== -1) {
      this.transcriptionQueue.splice(tIdx, 1);
    }

    await this.api.cancelJob(id);
  }

  retryJob(id) {
    const fileObj = this.allFiles.get(id);
    if (!fileObj || fileObj.restored) {
      alert('Невозможно повторить восстановленное задание (файл отсутствует). Загрузите файл заново.');
      return;
    }

    this.renderer.updateStatus(id, 'pending', 'Ожидание загрузки...');
    document.querySelector(`#${id} .retry-btn`).style.display = 'none';
    document.querySelector(`#${id} .delete-btn`).style.display = 'none';
    const progressBar = document.querySelector(`#${id} .progress-bar`);
    progressBar.style.backgroundColor = '';
    progressBar.classList.remove('completed', 'error');
    progressBar.style.width = '0%';

    this.uploadQueue.push(fileObj);
    this.processUploadQueue();
  }

  async deleteJob(id) {
    this.renderer.remove(id);
    this.allFiles.delete(id);

    // Remove from transcription queue if present
    const tIdx = this.transcriptionQueue.findIndex(f => f.id === id);
    if (tIdx !== -1) {
      this.transcriptionQueue.splice(tIdx, 1);
    }

    await this.api.deleteJob(id);
  }
}

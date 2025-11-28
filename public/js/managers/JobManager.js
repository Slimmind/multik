import { JobRenderer } from '../ui/JobRenderer.js';

export class JobManager {
  constructor(apiService, socketService) {
    this.api = apiService;
    this.socket = socketService;

    this.renderer = new JobRenderer(document.getElementById('fileList'), {
      onCancel: (id) => this.cancelJob(id),
      onRetry: (id) => this.retryJob(id),
      onDelete: (id) => this.deleteJob(id)
    });

    this.uploadQueue = [];
    this.isUploading = false;
    this.allFiles = new Map();

    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.socket.connect();

    this.socket.on('status_change', (data) => {
      if (data.status === 'processing') {
        this.renderer.updateStatus(data.id, 'processing', 'Конвертация... 0%');
        this.renderer.moveToTop(data.id);
      }
    });

    this.socket.on('progress', (data) => {
      this.renderer.updateProgress(data.id, data.progress);
    });

    this.socket.on('complete', (data) => {
      this.renderer.markCompleted(data.id, data.url, data.compressionRatio);
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
          restored: true
        };
        this.allFiles.set(job.id, fileObj);
        this.renderer.createFileItem(fileObj);

        if (job.thumbnail) {
          this.renderer.setThumbnail(job.id, job.thumbnail);
        }

        if (job.status === 'queued') {
          this.renderer.updateStatus(job.id, 'pending', 'В очереди на конвертацию');
          document.querySelector(`#${job.id} .cancel-btn`).style.display = 'inline-block';
        } else if (job.status === 'processing') {
          this.renderer.updateProgress(job.id, job.progress);
          this.renderer.moveToTop(job.id);
          document.querySelector(`#${job.id} .cancel-btn`).style.display = 'inline-block';
        } else if (job.status === 'completed') {
          this.renderer.markCompleted(job.id, job.url, job.compressionRatio);
        } else if (job.status === 'error') {
          this.renderer.markError(job.id, job.error);
        } else if (job.status === 'cancelled') {
          this.renderer.updateStatus(job.id, 'error', 'Отменено');
          // Show delete button for restored cancelled jobs
          document.querySelector(`#${job.id} .delete-btn`).style.display = 'inline-flex';
        }
      });
    } catch (e) {
      console.error('Failed to restore jobs', e);
    }
  }

  addFiles(files) {
    const newFiles = Array.from(files).map(file => {
      const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      return { id, file, status: 'pending', size: file.size };
    });

    newFiles.sort((a, b) => a.size - b.size);

    newFiles.forEach(fileObj => {
      this.allFiles.set(fileObj.id, fileObj);
      this.uploadQueue.push(fileObj);
      this.renderer.createFileItem(fileObj);
    });

    this.processUploadQueue();
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
      (percent) => this.renderer.updateUploadProgress(currentFile.id, percent),
      () => {
        this.renderer.updateStatus(currentFile.id, 'pending', 'В очереди на конвертацию');
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
    await this.api.deleteJob(id);
  }
}

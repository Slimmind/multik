import { ApiService } from './services/api.js';
import { SocketService } from './services/socket.js';
import { ThemeManager } from './managers/ThemeManager.js';
import { UploadManager } from './managers/UploadManager.js';
import { JobManager } from './managers/JobManager.js';

class App {
  constructor() {
    this.clientId = localStorage.getItem('multik_client_id');
    if (!this.clientId) {
      this.clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('multik_client_id', this.clientId);
    }

    this.api = new ApiService(this.clientId);
    this.socket = new SocketService(this.clientId);

    this.themeManager = new ThemeManager();
    this.jobManager = new JobManager(this.api, this.socket);

    this.uploadManager = new UploadManager((files) => {
      this.jobManager.addFiles(files);
    });

    this.init();
  }

  init() {
    this.jobManager.restoreState();
  }
}

new App();

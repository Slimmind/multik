import type { Job } from '../types';

class ApiService {
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async getJobs(): Promise<Job[]> {
    const res = await fetch(`/jobs/${this.clientId}`);
    return await res.json();
  }

  async cancelJob(jobId: string): Promise<void> {
    await fetch('/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
  }

  async deleteJob(jobId: string): Promise<void> {
    await fetch('/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
  }

  uploadFile(
    file: File,
    jobId: string,
    onProgress: (percent: number) => void,
    onSuccess: () => void,
    onError: (errorMsg: string) => void
  ): XMLHttpRequest {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('clientId', this.clientId);
    fd.append('jobId', jobId);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = function() {
      if (xhr.status === 200) {
        onSuccess();
      } else {
        let errorMsg = 'Ошибка загрузки';
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.error) errorMsg = resp.error;
        } catch(e) {}
        onError(errorMsg);
      }
    };

    xhr.onerror = function() {
      onError('Ошибка сети при загрузке');
    };

    xhr.open('POST', '/upload', true);
    xhr.send(fd);

    return xhr;
  }
}

export default ApiService;

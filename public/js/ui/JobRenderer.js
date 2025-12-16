export class JobRenderer {
  constructor(listElement, callbacks) {
    this.listElement = listElement;
    this.callbacks = callbacks; // { onCancel, onRetry, onDelete }
  }

  createFileItem(fileObj) {
    const li = document.createElement('li');
    li.id = fileObj.id;
    li.className = 'file-item';
    li.innerHTML = `
        <div class="file-content">
          <div class="file-thumbnail">
            <div class="thumbnail-placeholder"></div>
          </div>
          <div class="file-info">
            <div class="file-header">
              <span>
                ${fileObj.mode === 'audio' ? '🎵' : '🎬'} 
                ${fileObj.file.name}
              </span>
              <span class="file-status pending">Ожидание загрузки...</span>
              <button class="delete-btn" style="display:none;" title="Удалить">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 3.5L10.5 12C10.5 12.5 10 13 9.5 13H4.5C4 13 3.5 12.5 3.5 12L3 3.5M5.5 3.5V2C5.5 1.5 6 1 6.5 1H7.5C8 1 8.5 1.5 8.5 2V3.5M1.5 3.5H12.5M5.5 6V10.5M8.5 6V10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="progress-container">
              <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="actions" style="margin-top: 10px;">
               <button class="cancel-btn" style="display:none;">Отмена</button>
               <button class="retry-btn" style="display:none;">Повторить</button>
            </div>
          </div>
        </div>
      `;

    // Attach event listeners
    li.querySelector('.cancel-btn').onclick = () => this.callbacks.onCancel(fileObj.id);
    li.querySelector('.retry-btn').onclick = () => this.callbacks.onRetry(fileObj.id);
    li.querySelector('.delete-btn').onclick = () => this.callbacks.onDelete(fileObj.id);

    this.listElement.appendChild(li);
    return li;
  }

  updateStatus(id, status, text) {
    const li = document.getElementById(id);
    if (!li) return;

    // Remove old status classes
    li.classList.remove('pending', 'uploading', 'processing', 'completed', 'error');
    li.classList.add(status);

    const statusEl = li.querySelector('.file-status');
    statusEl.textContent = text;
    statusEl.className = `file-status ${status}`;
  }

  updateProgress(id, percent) {
    const li = document.getElementById(id);
    if (!li) return;
    li.querySelector('.progress-bar').style.width = percent + '%';
    this.updateStatus(id, 'processing', `Конвертация... ${percent}%`);
  }

  setThumbnail(id, url) {
    const li = document.getElementById(id);
    if (!li) return;
    const placeholder = li.querySelector('.thumbnail-placeholder');
    if (placeholder) {
      const img = new Image();
      img.onload = () => {
        placeholder.style.backgroundImage = `url(${url})`;
        placeholder.style.backgroundSize = 'cover';
        placeholder.style.backgroundPosition = 'center';
      };
      img.onerror = () => {
        console.warn(`Failed to load thumbnail for job ${id}: ${url}`);
        // Keep the default placeholder (favicon)
      };
      img.src = url;
    }
  }

  markCompleted(id, url, compressionRatio) {
    const li = document.getElementById(id);
    if (!li) return;

    const progressBar = li.querySelector('.progress-bar');
    progressBar.style.width = '100%';
    progressBar.classList.add('completed');

    let statusText = 'Готово';
    if (compressionRatio !== undefined && compressionRatio !== null) {
      statusText += ` (сжато на ${compressionRatio}%)`;
    }
    this.updateStatus(id, 'completed', statusText);

    li.querySelector('.cancel-btn').style.display = 'none';
    li.querySelector('.delete-btn').style.display = 'inline-flex';

    const statusEl = li.querySelector('.file-status');
    if (!statusEl.querySelector('.download-link')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.className = 'download-link';
      link.textContent = ' Скачать';
      link.onclick = () => {
        li.classList.add('downloaded');
      };
      statusEl.appendChild(link);
    }
  }

  markError(id, msg) {
    const li = document.getElementById(id);
    if (!li) return;

    this.updateStatus(id, 'error', `Ошибка: ${msg}`);
    const progressBar = li.querySelector('.progress-bar');
    progressBar.classList.add('error');
    progressBar.style.backgroundColor = '';

    li.querySelector('.cancel-btn').style.display = 'none';
    li.querySelector('.retry-btn').style.display = 'inline-block';
    li.querySelector('.delete-btn').style.display = 'inline-flex';
  }

  setUploading(id) {
    const li = document.getElementById(id);
    if (!li) return;

    this.updateStatus(id, 'uploading', 'Загрузка... 0%');
    li.querySelector('.cancel-btn').style.display = 'inline-block';
    li.querySelector('.retry-btn').style.display = 'none';
    li.querySelector('.delete-btn').style.display = 'none';
    li.querySelector('.progress-bar').classList.add('uploading');
  }

  updateUploadProgress(id, percent) {
    const li = document.getElementById(id);
    if (!li) return;
    li.querySelector('.progress-bar').style.width = percent + '%';
    li.querySelector('.file-status').textContent = `Загрузка... ${percent}%`;
  }

  moveToTop(id) {
    const li = document.getElementById(id);
    if (li) {
      this.listElement.prepend(li);
    }
  }

  remove(id) {
    const li = document.getElementById(id);
    if (li) {
      li.style.opacity = '0';
      li.style.transform = 'translateX(20px)';
      setTimeout(() => li.remove(), 200);
    }
  }
}

export class JobRenderer {
  constructor(listElements, callbacks) {
    this.listElements = listElements; // { video, audio, transcription }
    this.callbacks = callbacks; // { onCancel, onRetry, onDelete, onTranscribe }
  }

  getListElement(mode) {
    return this.listElements[mode] || this.listElements.video;
  }

  createFileItem(fileObj) {
    const li = document.createElement('li');
    li.id = fileObj.id;
    li.className = 'file-item';
    li.dataset.mode = fileObj.mode;
    li.dataset.size = fileObj.size || 0;
    li.innerHTML = `
        <div class="file-content">
          <header class="file-content-header">
            <div class="file-thumbnail">
              <div class="thumbnail-placeholder"></div>
            </div>
            <div class="file-info">
              <div class="file-header">
                <span>
                  ${fileObj.mode === 'audio' ? '🎵' : (fileObj.mode === 'transcription' ? '📝' : '🎬')}
                  ${fileObj.file.name}
                </span>
                <button class="delete-btn" style="display:none;" title="Удалить">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 3.5L10.5 12C10.5 12.5 10 13 9.5 13H4.5C4 13 3.5 12.5 3.5 12L3 3.5M5.5 3.5V2C5.5 1.5 6 1 6.5 1H7.5C8 1 8.5 1.5 8.5 2V3.5M1.5 3.5H12.5M5.5 6V10.5M8.5 6V10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <span class="file-status pending">Ожидание загрузки...</span>
              </div>
              <div class="progress-container">
                <div class="progress-bar" style="width: 0%"></div>
              </div>
              <div class="actions" style="margin-top: 10px;">
                <button class="cancel-btn" style="display:none;">Отмена</button>
                <button class="retry-btn" style="display:none;">Повторить</button>
              </div>
            </div>
          </header
        </div>
      `;

    // Attach event listeners
    li.querySelector('.cancel-btn').onclick = () => this.callbacks.onCancel(fileObj.id);
    li.querySelector('.retry-btn').onclick = () => this.callbacks.onRetry(fileObj.id);
    li.querySelector('.delete-btn').onclick = () => this.callbacks.onDelete(fileObj.id);

    const listElement = this.getListElement(fileObj.mode);
    listElement.appendChild(li);
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

  updateProgress(id, percent, mode) {
    const li = document.getElementById(id);
    if (!li) return;
    li.querySelector('.progress-bar').style.width = percent + '%';

    const statusText = mode === 'transcription'
      ? `Транскрибация... ${percent}%`
      : (mode === 'audio'
        ? `Экстракция аудио... ${percent}%`
        : `Конвертация... ${percent}%`);

    this.updateStatus(id, 'processing', statusText);
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
      };
      img.src = url;
    }
  }

  markCompleted(id, url, compressionRatio, mode) {
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

    // Add transcription checkbox for completed audio items
    if (mode === 'audio' && !li.querySelector('.transcription-checkbox')) {
      const actionsDiv = li.querySelector('.actions');
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.className = 'transcription-checkbox';
      checkboxWrapper.innerHTML = `
        <input type="checkbox" id="transcribe-${id}">
        <label for="transcribe-${id}">Транскрибировать</label>
      `;
      actionsDiv.insertBefore(checkboxWrapper, actionsDiv.firstChild);

      const checkbox = checkboxWrapper.querySelector('input');
      checkbox.onchange = () => {
        if (checkbox.checked && this.callbacks.onTranscribe) {
          this.callbacks.onTranscribe(id, url);
        }
      };
    }

    // Add textarea for completed transcription items
    if (mode === 'transcription' && !li.querySelector('.transcription-text-wrapper')) {
      this.addTranscriptionTextarea(li, url);
    }
  }

  async fetchTranscriptionText(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.text();
    } catch (e) {
      console.error('Failed to load transcription text:', e);
      throw e;
    }
  }

  async correctTranscriptionText(text) {
    try {
      const response = await fetch('/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('API error');
      }

      const data = await response.json();
      return data.correctedText;
    } catch (e) {
      console.error('AI correction failed:', e);
      throw e;
    }
  }

  async addTranscriptionTextarea(li, url) {
    const fileContent = li.querySelector('.file-content');

    const wrapper = document.createElement('div');
    wrapper.className = 'transcription-text-wrapper';
    wrapper.innerHTML = `
      <div class="textarea-container">
        <textarea name="transcription-result" class="transcription-result" readonly placeholder="Загрузка текста..."></textarea>
        <div class="textarea-actions">
          <button class="textarea-btn ai-btn" title="AI обработка">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" fill="currentColor"/>
              <path d="M5 3L5.5 5L7 4.5L5.5 5.5L5 8L4.5 5.5L3 5.5L4.5 5L5 3Z" fill="currentColor"/>
              <path d="M19 16L19.5 18L21 17.5L19.5 18.5L19 21L18.5 18.5L17 18.5L18.5 18L19 16Z" fill="currentColor"/>
            </svg>
          </button>
          <button class="textarea-btn copy-btn" title="Копировать">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    fileContent.appendChild(wrapper);

    const textarea = wrapper.querySelector('.transcription-result');
    const copyBtn = wrapper.querySelector('.copy-btn');
    const aiBtn = wrapper.querySelector('.ai-btn');

    // Load initial text
    try {
      const text = await this.fetchTranscriptionText(url);
      textarea.value = text;
      textarea.placeholder = '';
    } catch (e) {
      textarea.placeholder = 'Ошибка загрузки текста';
    }

    // Handlers
    copyBtn.onclick = () => this.handleCopy(textarea.value, copyBtn);
    aiBtn.onclick = () => this.handleAiCorrection(textarea, aiBtn);
  }

  async handleCopy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  async handleAiCorrection(textarea, btn) {
    if (!textarea.value.trim()) return;

    const originalText = textarea.value;

    try {
      btn.classList.add('processing');
      btn.disabled = true;
      textarea.placeholder = 'AI обрабатывает текст...';
      textarea.value = '';

      const correctedText = await this.correctTranscriptionText(originalText);

      textarea.value = correctedText || originalText;
      textarea.placeholder = '';
      btn.classList.add('success');
      setTimeout(() => btn.classList.remove('success'), 1500);
    } catch (e) {
      textarea.value = originalText;
      textarea.placeholder = '';
      btn.classList.add('error');
      setTimeout(() => btn.classList.remove('error'), 1500);
    } finally {
      btn.classList.remove('processing');
      btn.disabled = false;
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

  moveToTop(id, mode) {
    const li = document.getElementById(id);
    if (li) {
      const listElement = this.getListElement(mode);
      listElement.prepend(li);
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

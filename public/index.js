// --- Client ID Management ---
let clientId = localStorage.getItem('multik_client_id');
if (!clientId) {
    clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('multik_client_id', clientId);
}

const socket = io({
    query: { clientId }
});

let uploadQueue = [];
let isUploading = false;
const allFiles = new Map(); // Store all files by ID

// --- Restore State ---
async function restoreState() {
    try {
        const res = await fetch(`/jobs/${clientId}`);
        const jobs = await res.json();

        jobs.forEach(job => {
            const fileObj = {
                id: job.id,
                file: { name: job.filename }, // Mock
                status: job.status,
                restored: true
            };

            allFiles.set(job.id, fileObj);
            renderFileItem(fileObj);

            const li = document.getElementById(job.id);
            if (!li) return;

            // Set thumbnail if available
            if (job.thumbnail) {
                setThumbnail(job.id, job.thumbnail);
            }

            if (job.status === 'queued') {
                 li.querySelector('.file-status').textContent = 'В очереди на конвертацию';
                 li.querySelector('.file-status').className = 'file-status pending';
                 li.querySelector('.cancel-btn').style.display = 'inline-block';
            } else if (job.status === 'processing') {
                updateProgress(job.id, job.progress);
                li.querySelector('.file-status').className = 'file-status processing';
                li.querySelector('.cancel-btn').style.display = 'inline-block';
                fileList.prepend(li); // Move to top
            } else if (job.status === 'completed') {
                markCompleted(job.id, job.url, job.compressionRatio);
            } else if (job.status === 'error') {
                markError(job.id, job.error);
            } else if (job.status === 'cancelled') {
                li.querySelector('.file-status').textContent = 'Отменено';
                li.querySelector('.file-status').className = 'file-status error';
            }
        });
    } catch (e) {
        console.error('Failed to restore jobs', e);
    }
}

restoreState();

// --- Socket Events ---
socket.on('connect', () => {
    console.log('Connected with Client ID:', clientId);
});

socket.on('status_change', (data) => {
    const li = document.getElementById(data.id);
    if (li && data.status === 'processing') {
        li.querySelector('.file-status').textContent = 'Конвертация... 0%';
        li.querySelector('.file-status').className = 'file-status processing';
        fileList.prepend(li); // Move to top
    }
});

socket.on('progress', (data) => {
    updateProgress(data.id, data.progress);
});

socket.on('complete', (data) => {
    markCompleted(data.id, data.url, data.compressionRatio);
});

socket.on('error', (data) => {
    markError(data.id, data.message);
});

socket.on('thumbnail', (data) => {
    setThumbnail(data.id, data.url);
});

// --- UI Logic ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');

// Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset to allow same file selection again
});

function handleFiles(files) {
    const newFiles = Array.from(files).map(file => {
        const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        return { id, file, status: 'pending', size: file.size };
    });

    // Sort by size (ascending)
    newFiles.sort((a, b) => a.size - b.size);

    newFiles.forEach(fileObj => {
        allFiles.set(fileObj.id, fileObj);
        uploadQueue.push(fileObj);
        renderFileItem(fileObj);
    });

    processUploadQueue();
}

function renderFileItem(fileObj) {
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
              <span>${fileObj.file.name}</span>
              <span class="file-status pending">Ожидание загрузки...</span>
              <button class="delete-btn" style="display:none;" onclick="deleteItem('${fileObj.id}')" title="Удалить">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 3.5L10.5 12C10.5 12.5 10 13 9.5 13H4.5C4 13 3.5 12.5 3.5 12L3 3.5M5.5 3.5V2C5.5 1.5 6 1 6.5 1H7.5C8 1 8.5 1.5 8.5 2V3.5M1.5 3.5H12.5M5.5 6V10.5M8.5 6V10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="progress-container">
              <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="actions" style="margin-top: 10px;">
               <button class="cancel-btn" style="display:none;" onclick="cancelConversion('${fileObj.id}')">Отмена</button>
               <button class="retry-btn" style="display:none;" onclick="retryConversion('${fileObj.id}')">Повторить</button>
            </div>
          </div>
        </div>
      `;
    fileList.appendChild(li);
}

function setThumbnail(id, url) {
    const li = document.getElementById(id);
    if (li) {
        const placeholder = li.querySelector('.thumbnail-placeholder');
        if (placeholder) {
            placeholder.style.backgroundImage = `url(${url})`;
            placeholder.style.backgroundSize = 'cover';
            placeholder.style.backgroundPosition = 'center';
        }
    }
}

// --- Upload Queue Processing ---
async function processUploadQueue() {
    if (isUploading || uploadQueue.length === 0) return;

    isUploading = true;
    const currentFile = uploadQueue[0];

    const li = document.getElementById(currentFile.id);
    if (!li) {
        // Element might be missing if cancelled/removed before upload started
        uploadQueue.shift();
        isUploading = false;
        processUploadQueue();
        return;
    }

    // Update UI to uploading
    li.querySelector('.file-status').textContent = 'Загрузка... 0%';
    li.querySelector('.file-status').className = 'file-status uploading';
    li.querySelector('.cancel-btn').style.display = 'inline-block';
    li.querySelector('.retry-btn').style.display = 'none';
    li.querySelector('.progress-bar').classList.add('uploading');

    const fd = new FormData();
    fd.append('video', currentFile.file);
    fd.append('clientId', clientId);
    fd.append('jobId', currentFile.id);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            li.querySelector('.progress-bar').style.width = percentComplete + '%';
            li.querySelector('.file-status').textContent = `Загрузка... ${percentComplete}%`;
        }
    };

    xhr.onload = function() {
        li.querySelector('.progress-bar').classList.remove('uploading');
        if (xhr.status === 200) {
            // Upload complete, now it's queued on server
            li.querySelector('.file-status').textContent = 'В очереди на конвертацию';
            li.querySelector('.file-status').className = 'file-status pending';
            li.querySelector('.progress-bar').style.width = '0%'; // Reset for conversion progress

            uploadQueue.shift();
            isUploading = false;
            processUploadQueue();
        } else {
            let errorMsg = 'Ошибка загрузки';
            try {
                const resp = JSON.parse(xhr.responseText);
                if (resp.error) errorMsg = resp.error;
            } catch(e) {}

            markError(currentFile.id, errorMsg);
            uploadQueue.shift();
            isUploading = false;
            processUploadQueue();
        }
    };

    xhr.onerror = function() {
        li.querySelector('.progress-bar').classList.remove('uploading');
        markError(currentFile.id, 'Ошибка сети при загрузке');
        uploadQueue.shift();
        isUploading = false;
        processUploadQueue();
    };

    // Handle cancellation during upload
    currentFile.xhr = xhr;

    xhr.open('POST', '/upload', true);
    xhr.send(fd);
}

async function cancelConversion(id) {
    // Check if it's currently uploading
    const fileObj = allFiles.get(id);
    if (fileObj && fileObj.xhr) {
        fileObj.xhr.abort();
        fileObj.xhr = null;
        markError(id, 'Загрузка отменена');
        // Remove from upload queue
        const idx = uploadQueue.findIndex(f => f.id === id);
        if (idx !== -1) {
            uploadQueue.splice(idx, 1);
        }
        if (isUploading) {
             isUploading = false;
             processUploadQueue();
        }
        return;
    }

    // Optimistic UI update
    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.file-status').textContent = 'Отменено';
        li.querySelector('.file-status').className = 'file-status error';
        li.querySelector('.cancel-btn').style.display = 'none';

        if (fileObj && !fileObj.restored) {
            li.querySelector('.retry-btn').style.display = 'inline-block';
        }
        li.querySelector('.progress-bar').style.width = '0%';
        li.querySelector('.progress-bar').classList.add('error');
    }

    // Remove from upload queue if pending
    const idx = uploadQueue.findIndex(f => f.id === id);
    if (idx !== -1) {
        uploadQueue.splice(idx, 1);
        // If we removed the head but it wasn't uploading (shouldn't happen if logic is correct), check next
    }

    try {
        await fetch('/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: id })
        });
    } catch (e) {
        console.error('Cancel failed', e);
    }
}

window.retryConversion = function (id) {
    const fileObj = allFiles.get(id);
    if (!fileObj || fileObj.restored) {
        alert('Невозможно повторить восстановленное задание (файл отсутствует). Загрузите файл заново.');
        return;
    }

    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.file-status').textContent = 'Ожидание загрузки...';
        li.querySelector('.file-status').className = 'file-status pending';
        li.querySelector('.retry-btn').style.display = 'none';

        const progressBar = li.querySelector('.progress-bar');
        progressBar.style.backgroundColor = '';
        progressBar.classList.remove('completed', 'error');
        progressBar.style.width = '0%';
    }

    // Add to upload queue
    uploadQueue.push(fileObj);
    processUploadQueue();
}

window.deleteItem = async function(id) {
    const li = document.getElementById(id);
    if (!li) return;

    // Animate out
    li.style.opacity = '0';
    li.style.transform = 'translateX(20px)';

    setTimeout(async () => {
        li.remove();
        allFiles.delete(id);

        // Call server to delete files
        try {
            await fetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: id })
            });
        } catch (e) {
            console.error('Delete failed', e);
        }
    }, 200);
}

window.cancelConversion = cancelConversion;

function updateProgress(id, percent) {
    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.progress-bar').style.width = percent + '%';
        li.querySelector('.file-status').textContent = `Конвертация... ${percent}%`;
    }
}

function markCompleted(id, url, compressionRatio) {
    const li = document.getElementById(id);
    if (li) {
        const progressBar = li.querySelector('.progress-bar');
        progressBar.style.width = '100%';
        progressBar.classList.add('completed');

        const statusEl = li.querySelector('.file-status');
        let statusText = 'Готово';
        if (compressionRatio !== undefined && compressionRatio !== null) {
            statusText += ` (сжато на ${compressionRatio}%)`;
        }
        statusEl.textContent = statusText;
        statusEl.className = 'file-status completed';

        li.querySelector('.cancel-btn').style.display = 'none';
        li.querySelector('.delete-btn').style.display = 'inline-flex';

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
}

function markError(id, msg) {
    const li = document.getElementById(id);
    if (li) {
        const statusEl = li.querySelector('.file-status');
        statusEl.textContent = 'Ошибка: ' + msg;
        statusEl.className = 'file-status error';

        const progressBar = li.querySelector('.progress-bar');
        progressBar.classList.add('error');
        progressBar.style.backgroundColor = '';

        li.querySelector('.cancel-btn').style.display = 'none';

        const fileObj = allFiles.get(id);
        if (fileObj && !fileObj.restored) {
            li.querySelector('.retry-btn').style.display = 'inline-block';
        }
    }
}

// --- Client ID Management ---
let clientId = localStorage.getItem('multik_client_id');
if (!clientId) {
    clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('multik_client_id', clientId);
}

const socket = io({
    query: { clientId }
});

let queue = [];
let isProcessing = false;
const allFiles = new Map(); // Store all files by ID

// --- Restore State ---
async function restoreState() {
    try {
        const res = await fetch(`/jobs/${clientId}`);
        const jobs = await res.json();

        jobs.forEach(job => {
            // Reconstruct file object (mocking the File object since we can't restore it fully)
            // But we don't need the File object for completed/processing jobs unless we retry (which requires re-upload)
            // For now, we just show the status.

            const fileObj = {
                id: job.id,
                file: { name: job.filename }, // Mock
                status: job.status,
                restored: true // Flag to know we can't re-upload this easily without user action
            };

            allFiles.set(job.id, fileObj);
            renderFileItem(fileObj);

            if (job.status === 'processing') {
                // If it's processing, we don't add to queue immediately to avoid double upload,
                // but we need to listen to progress.
                // Actually, since it's server-side processing, we just update UI.
                updateProgress(job.id, job.progress);
                const li = document.getElementById(job.id);
                if (li) {
                    li.querySelector('.file-status').textContent = 'Конвертация...';
                    li.querySelector('.file-status').className = 'file-status processing';
                    li.querySelector('.cancel-btn').style.display = 'inline-block';
                }
            } else if (job.status === 'completed') {
                markCompleted(job.id, job.url);
            } else if (job.status === 'error') {
                markError(job.id, job.error);
            } else if (job.status === 'cancelled') {
                // Manually mark as cancelled
                const li = document.getElementById(job.id);
                if (li) {
                    li.querySelector('.file-status').textContent = 'Отменено';
                    li.querySelector('.file-status').className = 'file-status error';
                }
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

socket.on('progress', (data) => {
    // data: { id, progress }
    updateProgress(data.id, data.progress);
});

socket.on('complete', (data) => {
    // data: { id, url }
    markCompleted(data.id, data.url);

    // Remove from queue if it was there
    removeFromQueue(data.id);
    isProcessing = false;
    processQueue();
});

socket.on('error', (data) => {
    // data: { id, message }
    markError(data.id, data.message);

    removeFromQueue(data.id);
    isProcessing = false;
    processQueue();
});

function removeFromQueue(id) {
    const idx = queue.findIndex(f => f.id === id);
    if (idx !== -1) {
        queue.splice(idx, 1);
    }
}

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
    Array.from(files).forEach(file => {
        // Simple ID generation
        const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const fileObj = { id, file, status: 'pending' };

        allFiles.set(id, fileObj); // Store for later retrieval
        queue.push(fileObj);
        renderFileItem(fileObj);
    });

    processQueue();
}

function renderFileItem(fileObj) {
    const li = document.createElement('li');
    li.id = fileObj.id;
    li.className = 'file-item';
    li.innerHTML = `
        <div class="file-header">
          <span>${fileObj.file.name}</span>
          <span class="file-status pending">Ожидание...</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="actions" style="margin-top: 10px;">
           <button class="cancel-btn" style="display:none;" onclick="cancelConversion('${fileObj.id}')">Отмена</button>
           <button class="retry-btn" style="display:none;" onclick="retryConversion('${fileObj.id}')">Повторить</button>
        </div>
      `;
    fileList.appendChild(li);
}

// --- Queue Processing ---
async function processQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    const currentFile = queue[0];

    // Check if element exists (it might be a restored job that is not in DOM if we cleared it, but here we append)
    let li = document.getElementById(currentFile.id);
    if (!li) return; // Should not happen

    // Update UI to processing
    li.querySelector('.file-status').textContent = 'Конвертация...';
    li.querySelector('.file-status').className = 'file-status processing';
    li.querySelector('.cancel-btn').style.display = 'inline-block';
    li.querySelector('.retry-btn').style.display = 'none';

    // Reset progress bar color
    const progressBar = li.querySelector('.progress-bar');
    progressBar.classList.remove('completed', 'error');

    // Upload
    const fd = new FormData();
    fd.append('video', currentFile.file);
    fd.append('clientId', clientId);
    fd.append('jobId', currentFile.id);

    try {
        const res = await fetch('/convert', { method: 'POST', body: fd });
        const json = await res.json();

        if (json.error) {
            throw new Error(json.error);
        }
        // Wait for socket events (progress/complete/error)
    } catch (err) {
        markError(currentFile.id, err.message);
        queue.shift();
        isProcessing = false;
        processQueue();
    }
}

async function cancelConversion(id) {
    // Optimistic UI update
    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.file-status').textContent = 'Отменено';
        li.querySelector('.file-status').className = 'file-status error'; // Use error style for cancelled
        li.querySelector('.cancel-btn').style.display = 'none';
        // Retry is tricky for restored jobs because we don't have the file
        const fileObj = allFiles.get(id);
        if (fileObj && !fileObj.restored) {
            li.querySelector('.retry-btn').style.display = 'inline-block';
        }
        li.querySelector('.progress-bar').style.width = '0%';
        li.querySelector('.progress-bar').classList.add('error');
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

    // Remove from queue if it was processing
    removeFromQueue(id);
    if (isProcessing) { // If we cancelled the current one
        isProcessing = false;
        processQueue();
    }
}

// Redefine retryConversion with access to allFiles
window.retryConversion = function (id) {
    const fileObj = allFiles.get(id);
    if (!fileObj || fileObj.restored) {
        alert('Невозможно повторить восстановленное задание (файл отсутствует). Загрузите файл заново.');
        return;
    }

    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.file-status').textContent = 'Ожидание...';
        li.querySelector('.file-status').className = 'file-status pending';
        li.querySelector('.retry-btn').style.display = 'none';

        const progressBar = li.querySelector('.progress-bar');
        progressBar.style.backgroundColor = ''; // Reset inline styles
        progressBar.classList.remove('completed', 'error');
    }

    // Add to queue
    queue.push(fileObj);
    processQueue();
}

// Also expose cancelConversion to window
window.cancelConversion = cancelConversion;

function updateProgress(id, percent) {
    const li = document.getElementById(id);
    if (li) {
        li.querySelector('.progress-bar').style.width = percent + '%';
    }
}

function markCompleted(id, url) {
    const li = document.getElementById(id);
    if (li) {
        const progressBar = li.querySelector('.progress-bar');
        progressBar.style.width = '100%';
        progressBar.classList.add('completed');

        const statusEl = li.querySelector('.file-status');
        statusEl.textContent = 'Готово';
        statusEl.className = 'file-status completed';

        li.querySelector('.cancel-btn').style.display = 'none';

        // Add download link if not exists
        if (!statusEl.querySelector('.download-link')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = '';
            link.className = 'download-link';
            link.textContent = ' Скачать';
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
        progressBar.style.backgroundColor = ''; // Remove inline style if any

        li.querySelector('.cancel-btn').style.display = 'none';

        const fileObj = allFiles.get(id);
        if (fileObj && !fileObj.restored) {
            li.querySelector('.retry-btn').style.display = 'inline-block';
        }
    }
}

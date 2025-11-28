export class UploadManager {
  constructor(onFilesSelected) {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.onFilesSelected = onFilesSelected;
    this.init();
  }

  init() {
    this.dropZone.addEventListener('click', () => this.fileInput.click());

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      this.fileInput.value = '';
    });
  }

  handleFiles(files) {
    if (files.length > 0) {
      this.onFilesSelected(files);
    }
  }
}

export class UploadManager {
  constructor(onFilesSelected) {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.onFilesSelected = onFilesSelected;
    this.mode = 'video';
    this.tabContents = {
      video: document.getElementById('tab-video'),
      audio: document.getElementById('tab-audio'),
      transcription: document.getElementById('tab-transcription')
    };
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

    // Mode/Tab handling
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.mode = e.target.value;
        this.switchTab(this.mode);
      });
    });
  }

  switchTab(mode) {
    Object.entries(this.tabContents).forEach(([key, element]) => {
      if (element) {
        element.style.display = key === mode ? 'block' : 'none';
      }
    });
  }

  handleFiles(files) {
    if (files.length > 0) {
      this.mode = document.querySelector('input[name="mode"]:checked').value;
      this.onFilesSelected(files, this.mode);
    }
  }
}

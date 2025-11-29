import { memo, useRef, useState, useCallback } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: FileList) => void;
}

const DropZone = memo(({ onFilesSelected }: DropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  }, [onFilesSelected]);

  return (
    <div
      id="dropZone"
      className={isDragOver ? 'dragover' : ''}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Загрузить видео файлы"
    >
      <p>Перетащите файлы сюда или кликните для выбора</p>
      <input
        ref={fileInputRef}
        type="file"
        id="fileInput"
        multiple
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
});

DropZone.displayName = 'DropZone';

export default DropZone;

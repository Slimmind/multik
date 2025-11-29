import { STORAGE_KEYS } from '../constants';

export const generateClientId = (): string => {
  return 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

export const getClientId = (): string => {
  let id = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
  if (!id) {
    id = generateClientId();
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
  }
  return id;
};

export const generateJobId = (): string => {
  return 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const getStatusText = (
  status: string,
  progress: number,
  error?: string,
  compressionRatio?: number
): string => {
  switch (status) {
    case 'pending':
      return 'В очереди на конвертацию';
    case 'uploading':
      return `Загрузка... ${progress}%`;
    case 'processing':
      return `Конвертация... ${progress}%`;
    case 'completed':
      return `Готово${compressionRatio ? ` (сжато на ${compressionRatio}%)` : ''}`;
    case 'error':
      return `Ошибка: ${error || 'Неизвестная ошибка'}`;
    case 'cancelled':
      return 'Отменено';
    default:
      return 'Ожидание загрузки...';
  }
};

export const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = reject;
    img.src = url;
  });
};

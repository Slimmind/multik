export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
};

export const JOB_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const;

export const STATUS_COLORS = {
  [JOB_STATUS.PENDING]: 'warning',
  [JOB_STATUS.UPLOADING]: 'upload',
  [JOB_STATUS.PROCESSING]: 'primary',
  [JOB_STATUS.COMPLETED]: 'success',
  [JOB_STATUS.ERROR]: 'error',
  [JOB_STATUS.CANCELLED]: 'error'
} as const;

export const STORAGE_KEYS = {
  CLIENT_ID: 'multik_client_id',
  THEME: 'theme'
} as const;

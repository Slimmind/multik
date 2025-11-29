export type JobStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface Job {
  id: string;
  filename: string;
  status: JobStatus;
  progress: number;
  url?: string;
  error?: string;
  compressionRatio?: number;
  thumbnail?: string;
  file?: File;
  xhr?: XMLHttpRequest;
  restored?: boolean;
}

export interface SocketEvents {
  status_change: (data: { id: string; status: JobStatus }) => void;
  progress: (data: { id: string; progress: number }) => void;
  complete: (data: { id: string; url: string; compressionRatio: number }) => void;
  error: (data: { id: string; message: string }) => void;
  thumbnail: (data: { id: string; url: string }) => void;
}

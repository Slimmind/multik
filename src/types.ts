export type JobStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
export type JobMode = 'video' | 'audio' | 'transcription';

export interface Job {
  id: string;
  file?: File;
  filename: string;
  mode: JobMode;
  status: JobStatus;
  progress: number;
  size?: number;
  error?: string | null;
  url?: string;
  thumbnail?: string | null;
  compressionRatio?: number;
  sourceAudioUrl?: string;
  transcriptionText?: string;
  fetchedText?: boolean;
}

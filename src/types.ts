export type JobStatus = 'pending' | 'uploading' | 'queued' | 'processing' | 'completed' | 'error' | 'cancelled';
export type JobMode = 'video' | 'audio' | 'transcription';
export type EncodingMode = 'software' | 'hardware';

export interface Job {
  id: string;
  encodingMode?: EncodingMode;
  duration?: string;
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
  startTime?: number;
  endTime?: number;
  conversionDuration?: number;
}

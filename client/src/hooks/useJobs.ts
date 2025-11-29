import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job } from '../types';
import ApiService from '../services/api';
import SocketService from '../services/socket';
import { generateJobId } from '../utils';

export const useJobs = (clientId: string) => {
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const [uploadQueue, setUploadQueue] = useState<Job[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const apiRef = useRef(new ApiService(clientId));
  const socketRef = useRef(new SocketService(clientId));

  // Socket event handlers
  const handleStatusChange = useCallback((data: { id: string; status: string }) => {
    if (data.status === 'processing') {
      setJobs(prev => {
        const newMap = new Map(prev);
        const job = newMap.get(data.id);
        if (job) {
          job.status = 'processing';
          job.progress = 0;
        }
        return newMap;
      });
    }
  }, []);

  const handleProgress = useCallback((data: { id: string; progress: number }) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(data.id);
      if (job) {
        job.progress = data.progress;
      }
      return newMap;
    });
  }, []);

  const handleComplete = useCallback((data: { id: string; url: string; compressionRatio: number }) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(data.id);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.url = data.url;
        job.compressionRatio = data.compressionRatio;
      }
      return newMap;
    });
  }, []);

  const handleError = useCallback((data: { id: string; message: string }) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(data.id);
      if (job) {
        job.status = 'error';
        job.error = data.message;
      }
      return newMap;
    });
  }, []);

  const handleThumbnail = useCallback((data: { id: string; url: string }) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(data.id);
      if (job) {
        job.thumbnail = data.url;
      }
      return newMap;
    });
  }, []);

  // Setup socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    socket.connect();

    socket.on('status_change', handleStatusChange);
    socket.on('progress', handleProgress);
    socket.on('complete', handleComplete);
    socket.on('error', handleError);
    socket.on('thumbnail', handleThumbnail);

    return () => {
      socket.disconnect();
    };
  }, [handleStatusChange, handleProgress, handleComplete, handleError, handleThumbnail]);

  // Restore jobs on mount
  useEffect(() => {
    const restoreJobs = async () => {
      try {
        const restoredJobs = await apiRef.current.getJobs();
        const newMap = new Map<string, Job>();
        restoredJobs.forEach(job => {
          newMap.set(job.id, { ...job, restored: true });
        });
        setJobs(newMap);
      } catch (e) {
        console.error('Failed to restore jobs', e);
      }
    };
    restoreJobs();
  }, []);

  // Process upload queue
  const processQueue = useCallback(() => {
    if (isUploading || uploadQueue.length === 0) return;

    const currentJob = uploadQueue[0];
    if (!currentJob.file) return;

    setIsUploading(true);
    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(currentJob.id);
      if (job) job.status = 'uploading';
      return newMap;
    });

    const xhr = apiRef.current.uploadFile(
      currentJob.file,
      currentJob.id,
      (percent) => {
        setJobs(prev => {
          const newMap = new Map(prev);
          const job = newMap.get(currentJob.id);
          if (job) job.progress = percent;
          return newMap;
        });
      },
      () => {
        setJobs(prev => {
          const newMap = new Map(prev);
          const job = newMap.get(currentJob.id);
          if (job) {
            job.status = 'pending';
            job.progress = 0;
            job.xhr = undefined;
          }
          return newMap;
        });
        setUploadQueue(prev => prev.slice(1));
        setIsUploading(false);
      },
      (errorMsg) => {
        setJobs(prev => {
          const newMap = new Map(prev);
          const job = newMap.get(currentJob.id);
          if (job) {
            job.status = 'error';
            job.error = errorMsg;
            job.xhr = undefined;
          }
          return newMap;
        });
        setUploadQueue(prev => prev.slice(1));
        setIsUploading(false);
      }
    );

    setJobs(prev => {
      const newMap = new Map(prev);
      const job = newMap.get(currentJob.id);
      if (job) job.xhr = xhr;
      return newMap;
    });
  }, [isUploading, uploadQueue]);

  useEffect(() => {
    processQueue();
  }, [uploadQueue, isUploading, processQueue]);

  const addFiles = useCallback((files: FileList) => {
    const newJobs: Job[] = Array.from(files).map(file => ({
      id: generateJobId(),
      filename: file.name,
      file,
      status: 'pending',
      progress: 0
    }));

    newJobs.sort((a, b) => (a.file?.size || 0) - (b.file?.size || 0));

    setJobs(prev => {
      const newMap = new Map(prev);
      newJobs.forEach(job => newMap.set(job.id, job));
      return newMap;
    });

    setUploadQueue(prev => [...prev, ...newJobs]);
  }, []);

  const cancelJob = useCallback(async (id: string) => {
    const job = jobs.get(id);
    if (!job) return;

    if (job.xhr) {
      job.xhr.abort();
      setJobs(prev => {
        const newMap = new Map(prev);
        const j = newMap.get(id);
        if (j) {
          j.status = 'error';
          j.error = 'Загрузка отменена';
          j.xhr = undefined;
        }
        return newMap;
      });
      setUploadQueue(prev => prev.filter(j => j.id !== id));
      return;
    }

    setJobs(prev => {
      const newMap = new Map(prev);
      const j = newMap.get(id);
      if (j) {
        j.status = 'error';
        j.error = 'Отменено';
      }
      return newMap;
    });

    await apiRef.current.cancelJob(id);
  }, [jobs]);

  const retryJob = useCallback((id: string) => {
    const job = jobs.get(id);
    if (!job || job.restored || !job.file) {
      alert('Невозможно повторить восстановленное задание (файл отсутствует). Загрузите файл заново.');
      return;
    }

    setJobs(prev => {
      const newMap = new Map(prev);
      const j = newMap.get(id);
      if (j) {
        j.status = 'pending';
        j.progress = 0;
        j.error = undefined;
      }
      return newMap;
    });

    setUploadQueue(prev => [...prev, job]);
  }, [jobs]);

  const deleteJob = useCallback(async (id: string) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    await apiRef.current.deleteJob(id);
  }, []);

  return {
    jobs: Array.from(jobs.values()),
    addFiles,
    cancelJob,
    retryJob,
    deleteJob
  };
};

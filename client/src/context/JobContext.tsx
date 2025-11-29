import { createContext, useContext, type ReactNode } from 'react';
import type { Job } from '../types';

interface JobContextType {
  jobs: Job[];
  addFiles: (files: FileList) => void;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => void;
  deleteJob: (id: string) => Promise<void>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const useJobContext = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobContext must be used within JobProvider');
  }
  return context;
};

interface JobProviderProps {
  children: ReactNode;
  value: JobContextType;
}

export const JobProvider = ({ children, value }: JobProviderProps) => {
  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
};

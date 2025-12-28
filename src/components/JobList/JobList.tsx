import React from 'react'
import JobItem from '../JobItem'
import { Job, JobMode } from '../../types'
import './job-list.styles.css'

interface JobListProps {
  jobs: Job[];
  mode: JobMode;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onTranscribe: (id: string, audioUrl: string) => void;
  onCorrect: (id: string, text: string) => Promise<string | undefined>;
}

export const JobList = ({ jobs, mode, onDelete, onCancel, onRetry, onTranscribe, onCorrect }: JobListProps) => {
  const filteredJobs = jobs.filter(job => job.mode === mode)

  if (filteredJobs.length === 0) return null

  return (
    <ul className="file-list">
      {filteredJobs.map((job) => (
        <JobItem
          key={job.id}
          job={job}
          onDelete={onDelete}
          onCancel={onCancel}
          onRetry={onRetry}
          onTranscribe={onTranscribe}
          onCorrect={onCorrect}
        />
      ))}
    </ul>
  )
}

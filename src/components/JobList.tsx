import React from 'react'
import JobItem from './JobItem'
import { Job, JobMode } from '../types'

interface JobListProps {
  jobs: Job[];
  mode: JobMode;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onTranscribe: (id: string, audioUrl: string) => void;
  onCorrect: (id: string, text: string) => Promise<string | undefined>;
}

export default function JobList({ jobs, mode, onDelete, onCancel, onRetry, onTranscribe, onCorrect }: JobListProps) {
  const filteredJobs = jobs.filter((job) => job.mode === mode)

  return (
    <div className="tab-content" style={{ display: 'block' }}>
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
    </div>
  )
}

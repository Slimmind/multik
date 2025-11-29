import { memo } from 'react';
import JobItem from './JobItem';
import type { Job } from '../types';

interface JobListProps {
  jobs: Job[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

const JobList = memo(({ jobs, onCancel, onRetry, onDelete }: JobListProps) => {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <ul id="fileList">
      {jobs.map(job => (
        <JobItem
          key={job.id}
          job={job}
          onCancel={onCancel}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
});

JobList.displayName = 'JobList';

export default JobList;

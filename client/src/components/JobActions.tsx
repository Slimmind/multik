import { memo } from 'react';
import type { Job } from '../types';

interface JobActionsProps {
  job: Job;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

const JobActions = memo(({ job, onCancel, onRetry }: JobActionsProps) => {
  const showCancelButton = ['uploading', 'processing', 'pending'].includes(job.status);
  const showRetryButton = job.status === 'error' && !job.restored;

  if (!showCancelButton && !showRetryButton) {
    return null;
  }

  return (
    <div className="actions">
      {showCancelButton && (
        <button
          className="cancel-btn"
          onClick={() => onCancel(job.id)}
          aria-label="Отменить"
        >
          Отмена
        </button>
      )}
      {showRetryButton && (
        <button
          className="retry-btn"
          onClick={() => onRetry(job.id)}
          aria-label="Повторить"
        >
          Повторить
        </button>
      )}
    </div>
  );
});

JobActions.displayName = 'JobActions';

export default JobActions;

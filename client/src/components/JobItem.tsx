import { memo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Job as JobType } from '../types';
import { getStatusText } from '../utils';
import Thumbnail from './Thumbnail';
import ProgressBar from './ProgressBar';
import JobActions from './JobActions';
import { useThumbnail } from '../hooks/useThumbnail';

interface JobItemProps {
  job: JobType;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

const JobItem = memo(({ job, onCancel, onRetry, onDelete }: JobItemProps) => {
  const [downloaded, setDownloaded] = useState(false);
  const { thumbnailUrl } = useThumbnail(job.thumbnail);

  const statusText = getStatusText(job.status, job.progress, job.error, job.compressionRatio);
  const showDeleteButton = job.status === 'completed' || job.status === 'error';

  return (
    <li
      id={job.id}
      className={`file-item ${job.status} ${downloaded ? 'downloaded' : ''}`}
    >
      <div className="file-content">
        <Thumbnail url={thumbnailUrl || undefined} alt={job.filename} />

        <div className="file-info">
          <div className="file-header">
            <span title={job.filename}>{job.filename}</span>
            {showDeleteButton && (
              <button
                className="delete-btn"
                onClick={() => onDelete(job.id)}
                title="Удалить"
                aria-label="Удалить задачу"
              >
                <Trash2 size={14} />
              </button>
            )}
            <span className={`file-status ${job.status}`}>
              {statusText}
              {job.status === 'completed' && job.url && (
                <a
                  href={job.url}
                  download
                  className="download-link"
                  onClick={() => setDownloaded(true)}
                >
                  {' '}Скачать
                </a>
              )}
            </span>
          </div>

          <ProgressBar progress={job.progress} status={job.status} />
          <JobActions job={job} onCancel={onCancel} onRetry={onRetry} />
        </div>
      </div>
    </li>
  );
});

JobItem.displayName = 'JobItem';

export default JobItem;

import { memo } from 'react';

interface ProgressBarProps {
  progress: number;
  status: string;
}

const ProgressBar = memo(({ progress, status }: ProgressBarProps) => {
  return (
    <div className="progress-container">
      <div
        className={`progress-bar ${status}`}
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;

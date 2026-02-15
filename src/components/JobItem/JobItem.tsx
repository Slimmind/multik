import React, { useState, useEffect } from 'react'
import { Job } from '../../types'
import { t } from '../../locales/i18n'
import './job-item.styles.css'

interface JobItemProps {
  job: Job;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onTranscribe: (id: string, audioUrl: string) => void;
  onCorrect: (id: string, text: string) => Promise<string | undefined>;
}

export const JobItem = ({ job, onDelete, onCancel, onRetry, onTranscribe, onCorrect }: JobItemProps) => {
  const [transcriptionChecked, setTranscriptionChecked] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiSuccess, setAiSuccess] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [displayDuration, setDisplayDuration] = useState<string>('');

  useEffect(() => {
    let interval: Timer;

    const updateTimer = () => {
      if (job.status === 'completed' && job.duration) {
        setDisplayDuration(job.duration);
        return;
      }

      if (job.status === 'processing' && job.startTime) {
        const now = Date.now();
        const diff = now - job.startTime;
        const totalSeconds = Math.floor(diff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n: number) => n.toString().padStart(2, '0');
        setDisplayDuration(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else {
         setDisplayDuration('');
      }
    };

    updateTimer(); // Initial call

    if (job.status === 'processing') {
      interval = setInterval(updateTimer, 1000);
    }

    return () => clearInterval(interval);
  }, [job.status, job.startTime, job.duration, job.endTime]);

  // Helpers for status text
  const getStatusText = () => {
    if (job.status === 'uploading') return `${t('app.status.uploading')}... ${job.progress}%`
    if (job.status === 'queued') return t('app.status.queued')
    if (job.status === 'processing') {
      if (job.mode === 'transcription') return `${t('app.status.transcribing')} ${job.progress}%`
      if (job.mode === 'audio') return `${t('app.status.extracting')} ${job.progress}%`
      return `${t('app.status.converting')} ${job.progress}%`
    }
    if (job.status === 'completed') {
      let text = t('app.status.completed')
      if (job.compressionRatio) text += ` (${t('app.job.ratio')} ${job.compressionRatio}%)`
      return text
    }
    if (job.status === 'error') return `${t('app.status.error')}: ${job.error || t('app.status.unknown_error')}`
    return t('app.status.pending')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(job.transcriptionText || '');
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 1500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }

  const handleAiCorrection = async () => {
    if (!job.transcriptionText || isAiProcessing) return;
    setIsAiProcessing(true);
    try {
      await onCorrect(job.id, job.transcriptionText);
      setAiSuccess(true);
      setTimeout(() => setAiSuccess(false), 1500);
    } catch (e) {
      setAiError(true);
      setTimeout(() => setAiError(false), 1500);
    } finally {
      setIsAiProcessing(false);
    }
  }

  return (
    <li id={job.id} className={`file-item ${job.status}`} data-mode={job.mode}>
      <div className="file-content">
        <header className="file-content-header">
          <div className="file-thumbnail">
            <div
              className="thumbnail-placeholder"
              style={
                job.thumbnail
                  ? {
                    backgroundImage: `url(${job.thumbnail})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                  : {}
              }
            ></div>
          </div>

          <div className="file-info">
            <div className="file-header">
              <span>
                {job.mode === 'audio'
                  ? '🎵'
                  : job.mode === 'transcription'
                    ? '📝'
                    : '🎬'}{' '}
                {job.filename}
              </span>

              {/* Delete Button */}
              {(job.status === 'completed' || job.status === 'error') && (
                <button className="delete-btn" onClick={() => onDelete(job.id)} title={t('app.actions.delete')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M11 3.5L10.5 12C10.5 12.5 10 13 9.5 13H4.5C4 13 3.5 12.5 3.5 12L3 3.5M5.5 3.5V2C5.5 1.5 6 1 6.5 1H7.5C8 1 8.5 1.5 8.5 2V3.5M1.5 3.5H12.5M5.5 6V10.5M8.5 6V10.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              <div className="status-container">

                 <span className={`file-status ${job.status}`}>
                  {getStatusText()}
                  {job.status === 'completed' && job.url && (
                    <a href={job.url} download className="download-link"> {t('app.actions.download')}</a>
                  )}
                 </span>
              </div>
            </div>

            <div className="progress-container">
              <div
                className={`progress-bar ${job.status}`}
                style={{ width: job.status === 'completed' ? '100%' : `${job.progress}%` }}
              ></div>
            </div>

            <div className="actions">
              {job.status === 'uploading' && (
                <button className="cancel-btn" onClick={() => onCancel(job.id)}>{t('app.actions.cancel')}</button>
              )}
              {job.status === 'error' && (
                <button className="retry-btn" onClick={() => onRetry(job.id)}>{t('app.actions.retry')}</button>
              )}

              {/* Audio -> Transcribe Checkbox */}
              {job.status === 'completed' && job.mode === 'audio' && job.url && (
                <div className="transcription-checkbox">
                  <input
                    type="checkbox"
                    id={`transcribe-${job.id}`}
                    checked={transcriptionChecked}
                    onChange={(e) => {
                      setTranscriptionChecked(e.target.checked);
                      if (e.target.checked && job.url) onTranscribe(job.id, job.url);
                    }}
                  />
                  <label htmlFor={`transcribe-${job.id}`}>{t('app.actions.transcribe')}</label>
                </div>
              )}

              {/* Processing Duration */}
              {(job.status === 'completed' || job.status === 'processing') && (
                 <span className="duration-badge" style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: 'monospace' }}>
                   ⏱ {displayDuration}
                 </span>
              )}
            </div>
          </div>
        </header>

        {/* Transcription Result Area */}
        {job.mode === 'transcription' && job.status === 'completed' && (
          <div className="transcription-text-wrapper">
            <div className="textarea-container">
              <textarea
                name="transcription-result"
                className="transcription-result"
                readOnly
                value={job.transcriptionText || ''}
                placeholder={job.transcriptionText ? '' : t('app.job.loading_text')}
              />
              <div className="textarea-actions">
                <button
                  className={`textarea-btn ai-btn ${isAiProcessing ? 'processing' : ''} ${aiSuccess ? 'success' : ''} ${aiError ? 'error' : ''}`}
                  title={t('app.job.ai_tooltip')}
                  onClick={handleAiCorrection}
                  disabled={isAiProcessing}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" fill="currentColor" />
                    <path d="M5 3L5.5 5L7 4.5L5.5 5.5L5 8L4.5 5.5L3 5.5L4.5 5L5 3Z" fill="currentColor" />
                    <path d="M19 16L19.5 18L21 17.5L19.5 18.5L19 21L18.5 18.5L17 18.5L18.5 18L19 16Z" fill="currentColor" />
                  </svg>
                </button>
                <button
                  className={`textarea-btn copy-btn ${isCopying ? 'copied' : ''}`}
                  title={t('app.job.copy_tooltip')}
                  onClick={handleCopy}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

import React from 'react'
import { JobMode } from '../../types'
import { t } from '../../locales/i18n'
import './mode-selector.styles.css'

interface ModeSelectorProps {
  mode: JobMode;
  setMode: (mode: JobMode) => void;
}

export const ModeSelector = ({ mode, setMode }: ModeSelectorProps) => {
  return (
    <div className="segmented-control">
      <input
        type="radio"
        name="mode"
        value="video"
        id="mode-video"
        checked={mode === 'video'}
        onChange={() => setMode('video')}
      />
      <label htmlFor="mode-video">{t('app.modes.video')}</label>

      <input
        type="radio"
        name="mode"
        value="audio"
        id="mode-audio"
        checked={mode === 'audio'}
        onChange={() => setMode('audio')}
      />
      <label htmlFor="mode-audio">{t('app.modes.audio')}</label>

      <input
        type="radio"
        name="mode"
        value="transcription"
        id="mode-transcription"
        checked={mode === 'transcription'}
        onChange={() => setMode('transcription')}
      />
      <label htmlFor="mode-transcription">{t('app.modes.transcription')}</label>
    </div>
  )
}

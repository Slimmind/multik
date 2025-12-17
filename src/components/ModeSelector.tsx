import React from 'react'
import { JobMode } from '../types'

interface ModeSelectorProps {
  mode: JobMode;
  setMode: (mode: JobMode) => void;
}

export default function ModeSelector({ mode, setMode }: ModeSelectorProps) {
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
      <label htmlFor="mode-video">Конвертация (MP4)</label>

      <input
        type="radio"
        name="mode"
        value="audio"
        id="mode-audio"
        checked={mode === 'audio'}
        onChange={() => setMode('audio')}
      />
      <label htmlFor="mode-audio">Извлечение аудио</label>

      <input
        type="radio"
        name="mode"
        value="transcription"
        id="mode-transcription"
        checked={mode === 'transcription'}
        onChange={() => setMode('transcription')}
      />
      <label htmlFor="mode-transcription">Транскрибация</label>
    </div>
  )
}

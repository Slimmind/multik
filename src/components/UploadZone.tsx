import React, { useRef, useState, ChangeEvent, DragEvent } from 'react'
import { JobMode } from '../types'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  mode: JobMode;
}

export default function UploadZone({ onFilesSelected, mode }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
    e.target.value = '' // Reset input
  }

  const handleFiles = (files: FileList) => {
    if (files.length > 0) {
      const validFiles: File[] = []
      const invalidFiles: string[] = []

      Array.from(files).forEach((file) => {
        const type = file.type
        const isVideo = type.startsWith('video/')
        const isAudio = type.startsWith('audio/')

        let isValid = false

        if (mode === 'video' || mode === 'audio') {
          // For 'video' (conversion) and 'audio' (extraction), we expect VIDEO input
          isValid = isVideo
        } else if (mode === 'transcription') {
          // Transcription expects AUDIO input
          isValid = isAudio
        }

        if (isValid) {
          validFiles.push(file)
        } else {
          invalidFiles.push(file.name)
        }
      })

      if (invalidFiles.length > 0) {
        const modeName =
          mode === 'transcription'
            ? 'Транскрибация'
            : mode === 'audio'
              ? 'Извлечение аудио'
              : 'Конвертация видео'
        const expected = mode === 'transcription' ? 'аудио' : 'видео'
        alert(
          `Вкладка "${modeName}" принимает только ${expected} файлы.\n\nПропущены файлы:\n${invalidFiles.join(
            '\n'
          )}`
        )
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles)
      }
    }
  }

  return (
    <div
      id="dropZone"
      className={isDragOver ? 'dragover' : ''}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p>Перетащите файлы сюда или кликните для выбора</p>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="video/*,audio/*"
        style={{ display: 'none' }}
      />
    </div>
  )
}

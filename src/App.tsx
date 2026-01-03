import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/header'
import useSocket from './hooks/useSocket'
import useUploadQueue from './hooks/useUploadQueue'
import useInit from './hooks/useInit'
import { Job, JobMode } from './types'
import ModeSelector from "./components/ModeSelector"
import UploadZone from "./components/UploadZone"
import JobList from "./components/JobList"
import YoutubeInput from "./components/YoutubeInput"

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [mode, setMode] = useState<JobMode>('video')

  // -- Initialization logic moved to useInit --
  const { clientId, isDarkTheme, toggleTheme } = useInit()

  // -- Helpers --
  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(job => job.id === id ? { ...job, ...updates } : job))
  }, [])

  const moveToTop = useCallback((id: string) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.id === id)
      if (idx <= 0) return prev
      const job = prev[idx]
      const newJobs = [...prev]
      newJobs.splice(idx, 1)
      newJobs.unshift(job)
      return newJobs
    })
  }, [])

  // -- Hooks --
  const { addToQueue, cancelUpload, retryUpload } = useUploadQueue(clientId, updateJob)
  useSocket(clientId, updateJob, moveToTop)

  // -- Data Fetching --
  useEffect(() => {
    if (!clientId) return;

    const fetchJobs = async () => {
      try {
        const res = await fetch(`/jobs/${clientId}`)
        if (res.ok) {
          const data = await res.json()
          setJobs(data)
        }
      } catch (e) {
        console.error("[App] Failed to fetch jobs", e)
      }
    }
    fetchJobs()
  }, [clientId])

  // -- Actions --
  const handleFilesSelected = (files: File[]) => {
    const newJobs: Job[] = Array.from(files).map(file => ({
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: file,
      filename: file.name,
      mode: mode,
      status: 'pending',
      progress: 0,
      size: file.size
    }))

    setJobs(prev => [...newJobs, ...prev])
    addToQueue(newJobs)
  }

  const handleCancel = async (id: string) => {
    if (cancelUpload(id)) {
      updateJob(id, { status: 'error', error: 'Отменено' })
      return
    }

    try {
      await fetch('/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id })
      })
      updateJob(id, { status: 'error', error: 'Отменено' })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
    try {
      await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id })
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleRetry = (id: string) => {
    const job = jobs.find(j => j.id === id)
    if (!job || !job.file) {
      alert('Файл недоступен для повтора (обновите страницу и попробуйте загрузить заново)')
      return
    }

    updateJob(id, { status: 'pending', error: null, progress: 0 })
    retryUpload(job)
  }

  const handleTranscribe = async (id: string, audioUrl: string) => {
    const sourceJob = jobs.find(j => j.id === id)
    const newId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newJob: Job = {
      id: newId,
      filename: sourceJob ? sourceJob.filename.replace(/\.[^/.]+$/, '.txt') : 'transcription.txt',
      mode: 'transcription',
      status: 'pending',
      progress: 0,
      sourceAudioUrl: audioUrl,
      thumbnail: null
    }

    setJobs(prev => [newJob, ...prev])
    setMode('transcription')

    try {
      const res = await fetch('/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newId, audioUrl, clientId })
      })
      if (!res.ok) throw new Error('API Error')
    } catch (e) {
      updateJob(newId, { status: 'error', error: 'Ошибка запуска' })
    }
  }

  const handleCorrect = async (id: string, text: string) => {
    const res = await fetch('/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!res.ok) throw new Error('Failed to correct')
    const data = await res.json()
    updateJob(id, { transcriptionText: data.correctedText })
    return data.correctedText
  }

  // Handle automatic transcription text fetching
  useEffect(() => {
    jobs.forEach(job => {
      if (job.mode === 'transcription' && job.status === 'completed' && job.url && !job.transcriptionText && !job.fetchedText) {
        updateJob(job.id, { fetchedText: true })
        fetch(job.url)
          .then(r => r.text())
          .then(text => updateJob(job.id, { transcriptionText: text }))
          .catch(e => console.error(e))
      }
    })

  }, [jobs, updateJob])

  const handleYoutubeDownload = async (url: string) => {
    const newId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Optimistic UI update
    const newJob: Job = {
      id: newId,
      filename: `Video from ${url}`, // Will be updated by backend
      mode: 'youtube',
      status: 'pending',
      progress: 0,
      url: url,
      fetchedText: false
    }

    setJobs(prev => [newJob, ...prev])

    try {
      const res = await fetch('/download-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newId, url, clientId })
      })
      if (!res.ok) throw new Error('API Error')
    } catch (e) {
      updateJob(newId, { status: 'error', error: 'Ошибка запуска' })
    }
  }

  return (
    <>
      <Header isDarkTheme={isDarkTheme} toggleTheme={toggleTheme} />

      <ModeSelector mode={mode} setMode={setMode} />

      {mode === 'youtube' ? (
        <YoutubeInput onDownload={handleYoutubeDownload} />
      ) : (
        <UploadZone onFilesSelected={handleFilesSelected} mode={mode} />
      )}

      <JobList
        jobs={jobs}
        mode={mode}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onRetry={handleRetry}
        onTranscribe={handleTranscribe}
        onCorrect={handleCorrect}
      />
    </>
  )
}

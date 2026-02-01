import { Job, JobMode, EncodingMode } from '../types'

interface UseJobActionsProps {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  updateJob: (id: string, updates: Partial<Job>) => void;
  clientId: string | null;
  cancelUpload: (id: string) => boolean;
  retryUpload: (job: Job) => void;
  setMode: (mode: JobMode) => void;
}

export const useJobActions = ({
  jobs,
  setJobs,
  updateJob,
  clientId,
  cancelUpload,
  retryUpload,
  setMode
}: UseJobActionsProps) => {

  const handleFilesSelected = (files: File[], mode: JobMode, encodingMode: EncodingMode, addToQueue: (jobs: Job[]) => void) => {
    const newJobs: Job[] = Array.from(files).map(file => ({
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: file,
      filename: file.name,
      mode: mode,
      encodingMode: encodingMode,
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

  return {
    handleFilesSelected,
    handleCancel,
    handleDelete,
    handleRetry,
    handleTranscribe,
    handleCorrect
  }
}

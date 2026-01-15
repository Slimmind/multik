import { useRef } from 'react'
import { Job } from '../types'

export default function useUploadQueue(clientId: string, updateJob: (id: string, updates: Partial<Job>) => void) {
  const uploadQueue = useRef<Job[]>([])
  const isUploading = useRef(false)
  const activeUploads = useRef(new Map<string, XMLHttpRequest>()) // Map jobId -> xhr

  const processUploadQueue = () => {
    if (isUploading.current || uploadQueue.current.length === 0) return

    isUploading.current = true
    const job = uploadQueue.current.shift()

    if (!job || !job.file) {
        isUploading.current = false;
        processUploadQueue();
        return;
    }

    // Visual update
    updateJob(job.id, { status: 'uploading' })

    const fd = new FormData()
    fd.append('video', job.file)
    fd.append('clientId', clientId)
    fd.append('jobId', job.id)
    fd.append('mode', job.mode)
    if (job.encodingMode) fd.append('encodingMode', job.encodingMode)

    const xhr = new XMLHttpRequest()
    activeUploads.current.set(job.id, xhr)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        updateJob(job.id, { progress: percent })
      }
    }

    xhr.onload = () => {
      activeUploads.current.delete(job.id)
      if (xhr.status === 200) {
        updateJob(job.id, { status: 'pending', progress: 0 }) // Server takes over
      } else {
        let msg = 'Ошибка загрузки'
        try { msg = JSON.parse(xhr.responseText).error || msg } catch (e) { }
        updateJob(job.id, { status: 'error', error: msg })
      }
      isUploading.current = false
      processUploadQueue()
    }

    xhr.onerror = () => {
      activeUploads.current.delete(job.id)
      updateJob(job.id, { status: 'error', error: 'Network Error' })
      isUploading.current = false
      processUploadQueue()
    }

    xhr.open('POST', '/upload', true)
    xhr.send(fd)
  }

  const addToQueue = (newJobs: Job[]) => {
    newJobs.forEach(job => {
      uploadQueue.current.push(job)
    })
    processUploadQueue()
  }

  const cancelUpload = (id: string) => {
    if (activeUploads.current.has(id)) {
      activeUploads.current.get(id)?.abort()
      activeUploads.current.delete(id)
      isUploading.current = false
      processUploadQueue()
      return true
    }

    const qIdx = uploadQueue.current.findIndex(j => j.id === id)
    if (qIdx !== -1) {
      uploadQueue.current.splice(qIdx, 1)
      return true
    }

    return false
  }

  const retryUpload = (job: Job) => {
    uploadQueue.current.push(job)
    processUploadQueue()
  }

  return { addToQueue, cancelUpload, retryUpload, activeUploads }
}

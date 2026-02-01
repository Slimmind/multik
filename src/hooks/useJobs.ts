import { useState, useCallback, useEffect } from 'react'
import { Job } from '../types'

export const useJobs = (clientId: string | null) => {
  const [jobs, setJobs] = useState<Job[]>([])

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
        console.error("[useJobs] Failed to fetch jobs", e)
      }
    }
    fetchJobs()
  }, [clientId])

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

  return { jobs, setJobs, updateJob, moveToTop }
}

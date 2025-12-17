import { useEffect, useRef } from 'react'
import { JobStatus, Job } from '../types'

// Type definitions for Socket.IO events
interface StatusChangeData {
  id: string;
  status: JobStatus;
}

interface ProgressData {
  id: string;
  progress: number;
}

interface CompleteData {
  id: string;
  url: string;
  compressionRatio?: number;
}

interface ErrorData {
  id: string;
  message: string;
}

interface ThumbnailData {
  id: string;
  url: string;
}

declare global {
  interface Window {
    io: any;
  }
}

export default function useSocket(
  clientId: string,
  onUpdateJob: (id: string, updates: Partial<Job>) => void,
  onMoveToTop: (id: string) => void
) {
  const socketRef = useRef<any>(null)

  useEffect(() => {
    if (!clientId) return

    if (window.io) {
      const socket = window.io({ query: { clientId } })
      socketRef.current = socket

      socket.on('connect', () => console.log('[Socket] Connected'))

      socket.on('status_change', (data: StatusChangeData) => {
        onUpdateJob(data.id, { status: data.status })
        if (data.status === 'processing') {
          onMoveToTop(data.id)
        }
      })

      socket.on('progress', (data: ProgressData) => {
        onUpdateJob(data.id, { progress: data.progress })
      })

      socket.on('complete', (data: CompleteData) => {
        onUpdateJob(data.id, {
          status: 'completed',
          url: data.url,
          compressionRatio: data.compressionRatio,
          progress: 100
        })
      })

      socket.on('error', (data: ErrorData) => {
        onUpdateJob(data.id, { status: 'error', error: data.message })
      })

      socket.on('thumbnail', (data: ThumbnailData) => {
        onUpdateJob(data.id, { thumbnail: data.url })
      })
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [clientId, onUpdateJob, onMoveToTop])

  return socketRef.current
}

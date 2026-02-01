import React, { useState } from 'react'
import Header from './components/header'
import useSocket from './hooks/useSocket'
import useUploadQueue from './hooks/useUploadQueue'
import useInit from './hooks/useInit'
import { JobMode, EncodingMode } from './types'
import ModeSelector from "./components/ModeSelector"
import UploadZone from "./components/UploadZone"
import { EncodingToggle } from "./components/EncodingToggle/EncodingToggle"
import JobList from "./components/JobList"
import { useJobs } from './hooks/useJobs'
import { useJobActions } from './hooks/useJobActions'

export default function App() {
  const [mode, setMode] = useState<JobMode>('video')
  const [encodingMode, setEncodingMode] = useState<EncodingMode>('hardware')

  // -- Initialization --
  const { clientId, isDarkTheme, toggleTheme } = useInit()

  // -- State & Data --
  const { jobs, setJobs, updateJob, moveToTop } = useJobs(clientId)

  // -- Hooks --
  const { addToQueue, cancelUpload, retryUpload } = useUploadQueue(clientId, updateJob)
  useSocket(clientId, updateJob, moveToTop)

  // -- Actions --
  const {
    handleFilesSelected,
    handleCancel,
    handleDelete,
    handleRetry,
    handleTranscribe,
    handleCorrect
  } = useJobActions({
    jobs,
    setJobs,
    updateJob,
    clientId,
    cancelUpload,
    retryUpload,
    setMode
  })

  return (
    <>
      <Header isDarkTheme={isDarkTheme} toggleTheme={toggleTheme} />

      <ModeSelector mode={mode} setMode={setMode} />

      <UploadZone
        onFilesSelected={(files) => handleFilesSelected(files, mode, encodingMode, addToQueue)}
        mode={mode}
      />

      {/* Encoding Mode Toggle */}
      {mode === 'video' && (
        <EncodingToggle
          encodingMode={encodingMode}
          setEncodingMode={setEncodingMode}
          disabled={jobs.some(job => job.status !== 'completed' && job.status !== 'error')}
        />
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

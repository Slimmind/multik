import { useState, useMemo } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import JobList from './components/JobList';
import { JobProvider } from './context/JobContext';
import { useJobs } from './hooks/useJobs';
import { getClientId } from './utils';
import './App.css';

function App() {
  const [clientId] = useState(getClientId);
  const jobContext = useJobs(clientId);

  const contextValue = useMemo(() => jobContext, [jobContext]);

  return (
    <JobProvider value={contextValue}>
      <Header />
      <DropZone onFilesSelected={jobContext.addFiles} />
      <JobList
        jobs={jobContext.jobs}
        onCancel={jobContext.cancelJob}
        onRetry={jobContext.retryJob}
        onDelete={jobContext.deleteJob}
      />
    </JobProvider>
  );
}

export default App;

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from 'bun:test'
import { JobItem } from './JobItem'
import { Job } from '../../types'

const mockJob: Job = {
  id: 'job-1',
  filename: 'test-video.mp4',
  mode: 'video',
  status: 'completed',
  progress: 100,
  url: '/output/test-video.mp4',
}

const mockHandlers = {
  onDelete: jest.fn(),
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  onTranscribe: jest.fn(),
  onCorrect: jest.fn(),
}

describe('JobItem Component', () => {
  it('renders filename and status text correctly', () => {
    const { getByText } = render(<JobItem job={mockJob} {...mockHandlers} />)
    expect(getByText(/test-video.mp4/)).toBeInTheDocument()
    expect(getByText(/Готово/)).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    const { getByTitle } = render(<JobItem job={mockJob} {...mockHandlers} />)
    const deleteBtn = getByTitle('Удалить')
    fireEvent.click(deleteBtn)
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('job-1')
  })

  it('shows error message when job status is error', () => {
    const errorJob: Job = { ...mockJob, status: 'error', error: 'Something went wrong' }
    const { getByText } = render(<JobItem job={errorJob} {...mockHandlers} />)
    expect(getByText(/Ошибка: Something went wrong/)).toBeInTheDocument()
    expect(getByText(/Повторить/)).toBeInTheDocument()
  })

  it('shows progress when uploading', () => {
    const uploadingJob: Job = { ...mockJob, status: 'uploading', progress: 45 }
    const { getByText } = render(<JobItem job={uploadingJob} {...mockHandlers} />)
    expect(getByText(/Загрузка... 45%/)).toBeInTheDocument()
    expect(getByText(/Отмена/)).toBeInTheDocument()
  })

  it('shows waiting message when queued', () => {
    const queuedJob: Job = { ...mockJob, status: 'queued' }
    const { getByText } = render(<JobItem job={queuedJob} {...mockHandlers} />)
    expect(getByText(/Ожидание обработки.../)).toBeInTheDocument()
  })
})

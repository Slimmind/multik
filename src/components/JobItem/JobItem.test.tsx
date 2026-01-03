import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { JobItem } from './JobItem'
import { Job } from '../types'

const mockJob: Job = {
  id: 'job-1',
  filename: 'test-video.mp4',
  mode: 'video',
  status: 'completed',
  progress: 100,
  url: '/output/test-video.mp4',
}

const mockHandlers = {
  onDelete: vi.fn(),
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onTranscribe: vi.fn(),
  onCorrect: vi.fn(),
}

describe('JobItem Component', () => {
  it('renders filename and status text correctly', () => {
    render(<JobItem job={mockJob} {...mockHandlers} />)
    expect(screen.getByText(/test-video.mp4/)).toBeInTheDocument()
    expect(screen.getByText(/Готово/)).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    render(<JobItem job={mockJob} {...mockHandlers} />)
    const deleteBtn = screen.getByTitle('Удалить')
    fireEvent.click(deleteBtn)
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('job-1')
  })

  it('shows error message when job status is error', () => {
    const errorJob: Job = { ...mockJob, status: 'error', error: 'Something went wrong' }
    render(<JobItem job={errorJob} {...mockHandlers} />)
    expect(screen.getByText(/Ошибка: Something went wrong/)).toBeInTheDocument()
    expect(screen.getByText(/Повторить/)).toBeInTheDocument()
  })

  it('shows progress when uploading', () => {
    const uploadingJob: Job = { ...mockJob, status: 'uploading', progress: 45 }
    render(<JobItem job={uploadingJob} {...mockHandlers} />)
    expect(screen.getByText(/Загрузка... 45%/)).toBeInTheDocument()
    expect(screen.getByText(/Отмена/)).toBeInTheDocument()
  })
})

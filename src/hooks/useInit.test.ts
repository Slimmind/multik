import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useInit from './useInit'

describe('useInit Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('should initialize clientId from localStorage', () => {
    localStorage.setItem('multik_client_id', 'test-client-id')
    const { result } = renderHook(() => useInit())
    expect(result.current.clientId).toBe('test-client-id')
  })

  it('should generate a new clientId if none exists', () => {
    const { result } = renderHook(() => useInit())
    expect(result.current.clientId).toMatch(/^client-/)
    expect(localStorage.getItem('multik_client_id')).toBe(result.current.clientId)
  })

  it('should toggle theme and update localStorage', () => {
    const { result } = renderHook(() => useInit())
    expect(result.current.isDarkTheme).toBe(false)

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.isDarkTheme).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.body.classList.contains('dark-mode')).toBe(true)

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.isDarkTheme).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.body.classList.contains('dark-mode')).toBe(false)
  })
})

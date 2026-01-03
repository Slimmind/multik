import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from 'bun:test'
import useInit from './useInit'

describe('useInit Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
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

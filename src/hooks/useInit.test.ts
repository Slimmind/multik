import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import useInit from './useInit'

// Mock fetch globally
global.fetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ isRPi: false })
})) as any;

describe('useInit Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mock().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: mock(),
        removeListener: mock(),
        addEventListener: mock(),
        removeEventListener: mock(),
        dispatchEvent: mock(),
      })),
    })
  })

  it('should initialize clientId from localStorage', async () => {
    localStorage.setItem('multik_client_id', 'test-client-id')
    const { result } = renderHook(() => useInit())

    await waitFor(() => {
        expect(result.current.clientId).toBe('test-client-id')
    })
  })

  it('should generate a new clientId if none exists', async () => {
    const { result } = renderHook(() => useInit())

    await waitFor(() => {
        expect(result.current.clientId).toMatch(/^client-/)
    })
    expect(localStorage.getItem('multik_client_id')).toBe(result.current.clientId)
  })

  it('should toggle theme and update localStorage', async () => {
    const { result } = renderHook(() => useInit())

    await waitFor(() => {
        expect(result.current.clientId).not.toBe('')
    })

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

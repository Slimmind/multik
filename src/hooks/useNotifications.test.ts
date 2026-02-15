import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import { useNotifications } from './useNotifications'

describe('useNotifications Hook', () => {
  beforeEach(() => {
    mock.restore()

    // Mock Notification API
    global.Notification = mock(function(title: string, options?: any) {
        this.title = title;
        this.options = options;
    }) as any;
    (global.Notification as any).permission = 'default';
    (global.Notification as any).requestPermission = mock(() => Promise.resolve('granted'));
  })

  it('should request permission', async () => {
    const { result } = renderHook(() => useNotifications())
    const granted = await result.current.requestPermission()

    expect(granted).toBe(true)
    expect(Notification.requestPermission).toHaveBeenCalled()
  })

  it('should not show notification if permission is not granted', () => {
    (Notification as any).permission = 'denied'
    const { result } = renderHook(() => useNotifications())

    result.current.showNotification('Test Title')
    expect(Notification).not.toHaveBeenCalled()
  })

  it('should show notification if permission is granted', () => {
    (Notification as any).permission = 'granted'
    const { result } = renderHook(() => useNotifications())

    result.current.showNotification('Test Title', { body: 'Test Body' })
    expect(Notification).toHaveBeenCalled()
  })
})

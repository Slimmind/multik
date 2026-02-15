import { describe, it, expect } from 'bun:test'
import { t } from './i18n'

describe('i18n Utility', () => {
  it('should return the correct translation for a simple key', () => {
    expect(t('app.title')).toBe('Multik')
  })

  it('should return the correct translation for a nested key', () => {
    expect(t('app.status.completed')).toBe('Готово')
  })

  it('should handle dynamic replacements', () => {
    // Note: app.upload.alert_text is "Вкладка \"{mode}\" принимает только {expected} файлы."
    const result = t('app.upload.alert_text', { mode: 'Видео', expected: 'видео' })
    expect(result).toBe('Вкладка "Видео" принимает только видео файлы.')
  })

  it('should return the key if translation is missing', () => {
    expect(t('non.existent.key')).toBe('non.existent.key')
  })

  it('should handle partially missing paths', () => {
    expect(t('app.missing')).toBe('app.missing')
  })
})

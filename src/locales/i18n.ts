import ru from './ru.json';

type TranslationKeys = typeof ru;

// Simple i18n implementation
// In a real app we might use react-i18next,
// but for this small project a simple helper is enough.

export const translations = ru;

export type Locale = 'ru';

export const getTranslation = (path: string, replacements?: Record<string, string>): string => {
  const keys = path.split('.');
  let result: any = translations;

  for (const key of keys) {
    if (result[key] === undefined) {
      console.warn(`Translation key not found: ${path}`);
      return path;
    }
    result = result[key];
  }

  let value = result;
  if (typeof value === 'string' && replacements) {
    Object.entries(replacements).forEach(([key, val]) => {
      value = value.replace(`{${key}}`, val)
    })
  }

  return typeof value === 'string' ? value : path;
};

export const t = getTranslation;

import { useCallback } from 'react';
import { Job } from '../types';
import { t } from '../locales/i18n';

export const useNotifications = () => {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/favicon.svg',
        ...options
      });
    } catch (e) {
      console.warn("Failed to show notification", e);
    }
  }, []);

  const notifyJobStatus = useCallback((job: Job) => {
    if (job.status === 'completed') {
      showNotification(`${t('app.title')}: ${t('app.status.completed')}`, {
        body: job.filename
      });
    } else if (job.status === 'error') {
      showNotification(`${t('app.title')}: ${t('app.status.error')}`, {
        body: `${job.filename}: ${job.error || t('app.status.unknown_error')}`
      });
    }
  }, [showNotification]);

  return { requestPermission, showNotification, notifyJobStatus };
};

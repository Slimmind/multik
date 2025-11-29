import { useState, useEffect } from 'react';
import { loadImage } from '../utils';

export const useThumbnail = (url?: string) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) return;

    setIsLoading(true);
    setError(null);

    loadImage(url)
      .then(setThumbnailUrl)
      .catch((err) => {
        console.warn(`Failed to load thumbnail: ${url}`, err);
        setError(err);
      })
      .finally(() => setIsLoading(false));
  }, [url]);

  return { thumbnailUrl, isLoading, error };
};

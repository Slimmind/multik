import React, { useState } from 'react';
import './youtube-input.styles.css';

interface YoutubeInputProps {
  onDownload: (url: string) => void;
  isLoading?: boolean;
}

const YoutubeInput: React.FC<YoutubeInputProps> = ({ onDownload, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onDownload(url.trim());
      setUrl('');
    }
  };

  return (
    <form className="youtube-wrapper" onSubmit={handleSubmit}>
      <input
        type="url"
        className="youtube-input"
        placeholder="Вставьте ссылку на YouTube видео..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        pattern="https://.*"
        required
      />
      <button type="submit" className="youtube-button" disabled={!url || isLoading}>
        {isLoading ? 'Загрузка...' : 'Скачать'}
      </button>
    </form>
  );
};

export default YoutubeInput;

import React from 'react';
import { EncodingMode } from '../../types';
import './encoding-toggle.styles.css';

interface EncodingToggleProps {
  encodingMode: EncodingMode;
  setEncodingMode: (mode: EncodingMode) => void;
}

export const EncodingToggle = ({ encodingMode, setEncodingMode }: EncodingToggleProps) => {
  return (
    <div className="encoding-toggle-container">
      <div className="encoding-toggle">
        <button
          className={`toggle-btn ${encodingMode === 'software' ? 'active' : ''}`}
          onClick={() => setEncodingMode('software')}
          type="button"
        >
          Software (CPU)
        </button>
        <button
          className={`toggle-btn ${encodingMode === 'hardware' ? 'active' : ''}`}
          onClick={() => setEncodingMode('hardware')}
          type="button"
        >
          Hardware (GPU)
        </button>
      </div>
    </div>
  );
};

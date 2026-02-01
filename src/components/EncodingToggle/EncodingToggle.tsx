import React from 'react';
import { EncodingMode } from '../../types';
import './encoding-toggle.styles.css';

interface EncodingToggleProps {
  encodingMode: EncodingMode;
  setEncodingMode: (mode: EncodingMode) => void;
  disabled?: boolean;
}

export const EncodingToggle = ({ encodingMode, setEncodingMode, disabled }: EncodingToggleProps) => {
  return (
    <div className={`encoding-toggle-container ${disabled ? 'disabled' : ''}`}>
      <div className="encoding-toggle">
        <button
          className={`toggle-btn ${encodingMode === 'software' ? 'active' : ''}`}
          onClick={() => !disabled && setEncodingMode('software')}
          type="button"
          disabled={disabled}
        >
          Software (CPU)
        </button>
        <button
          className={`toggle-btn ${encodingMode === 'hardware' ? 'active' : ''}`}
          onClick={() => !disabled && setEncodingMode('hardware')}
          type="button"
          disabled={disabled}
        >
          Hardware (GPU)
        </button>
      </div>
    </div>
  );
};

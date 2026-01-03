import { describe, it, expect } from 'bun:test';
import FFmpegService from './FFmpegService.js';

describe('FFmpegService', () => {
  it('should correctly convert time string to seconds', () => {
    expect(FFmpegService.timeToSeconds('00:00:10')).toBe(10);
    expect(FFmpegService.timeToSeconds('00:01:00')).toBe(60);
    expect(FFmpegService.timeToSeconds('01:00:00')).toBe(3600);
    expect(FFmpegService.timeToSeconds('00:01:30.500')).toBe(90.5);
  });
});

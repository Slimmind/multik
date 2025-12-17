const FFmpegService = require('./FFmpegService');

describe('FFmpegService', () => {
  it('should correctly convert time string to seconds', () => {
    expect(FFmpegService.timeToSeconds('00:01:30')).toBe(90);
    expect(FFmpegService.timeToSeconds('01:00:00')).toBe(3600);
    expect(FFmpegService.timeToSeconds('00:00:05.500')).toBe(5.5);
  });

  // Since FFmpegService uses child_process.spawn, we would normally mock it
  // for unit tests. For now, we test the logic we can.
});

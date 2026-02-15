interface Config {
  port: number;
  timeout: number;
  ffmpeg: {
    threads: number;
    videoBitrate: string;
    videoPreset: string;
    thumbnailWidth: number;
  };
  upload: {
    maxFileSize: number;
    allowedVideoTypes: string[];
    allowedAudioTypes: string[];
  };
  dirs: {
    uploads: string;
    output: string;
    dist: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  timeout: parseInt(process.env.TIMEOUT || '7200000', 10), // 120 minutes

  ffmpeg: {
    threads: parseInt(process.env.FFMPEG_THREADS || '4', 10),
    videoBitrate: process.env.FFMPEG_VIDEO_BITRATE || '10M',
    videoPreset: process.env.FFMPEG_PRESET || 'fast',
    thumbnailWidth: parseInt(process.env.FFMPEG_THUMB_WIDTH || '320', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5368709120', 10), // 5GB
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/mpeg', 'video/3gpp'],
    allowedAudioTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/aac'],
  },

  dirs: {
    uploads: process.env.UPLOADS_DIR || 'uploads',
    output: process.env.OUTPUT_DIR || 'output',
    dist: process.env.DIST_DIR || 'dist',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};

export default config;

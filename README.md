# Multik - Multimedia Converter & Transcriber

Multik is a high-performance web-based application for processing multimedia files, powered by **Bun.js**. It allows users to convert videos to audio, transcribe audio to text, and AI-correct transcriptions.

The project features a modern React frontend built with Vite and a streamlined, modernized **ESM** backend running on Bun.

## Features

- **Video to Audio Conversion**: Upload video files and convert them to high-quality MP3.
- **Audio to Text Transcription**: Transcribe audio files using OpenAI Whisper (local execution via Python).
- **AI Text Correction**: Automated error correction using Google Gemini AI.
- **Real-time Progress**: Live tracking via Socket.IO.
- **Modern UI**: MacOS-inspired glassmorphism, dark mode, and drag-and-drop support.

## Tech Stack

- **Runtime**: [Bun.js](https://bun.sh/)
- **Frontend**: React 19, Vite 7
- **Backend**: Express (ESM), Socket.IO 4
- **Processing**: FFmpeg (multimedia), OpenAI Whisper (transcription)
- **AI**: Google Gemini Pro

## Prerequisites

- **Bun**: [v1.1+](https://bun.sh/)
- **Python**: v3.8+ (for Whisper)
- **FFmpeg**: Must be installed and available in system PATH
- **OpenAI Whisper**: `pip install openai-whisper`

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/slimmind/multik.git
    cd multik
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory:
    ```env
    GEMINI_API_KEY=your_google_gemini_api_key
    ```

## Development

To run the application in development mode:

1.  Start the backend server:
    ```bash
    bun start
    ```

2.  Start the Vite frontend dev server:
    ```bash
    bun run dev
    ```

    Open `http://localhost:5173` in your browser.

## Production

To build and run the production-ready application:

1.  Build the frontend:
    ```bash
    bun run build
    ```

2.  Start the integrated server:
    ```bash
    bun start
    ```

    Open `http://localhost:3000` in your browser.

## Tests

Run tests using the Bun-integrated test runner or Vitest:
```bash
bun test
```

## License

MIT
# Multik - Multimedia Converter & Transcriber

Multik is a web-based application for processing multimedia files. It allows users to convert videos to audio, transcribe audio to text, and AI-correct transcritptions. The project has been refactored to use a modern React frontend with Vite, while maintaining a robust Node.js/Express backend.

## Features

- **Video to Audio Conversion**: Upload video files and convert them to MP3.
- **Audio to Text Transcription**: Transcribe audio files using OpenAI Whisper (local execution via Python).
- **AI Text Correction**: Correct transcription errors using Google Gemini AI.
- **Real-time Updates**: Progress tracking via Socket.IO.
- **Modern UI**: Drag-and-drop uploads, dark mode support, and a responsive design built with React.

## Tech Stack

- **Frontend**: React, Vite, CSS (MacOS-inspired aesthetics).
- **Backend**: Node.js, Express, Socket.IO.
- **Processing**: FFmpeg (video/audio), OpenAI Whisper (transcription).
- **AI Services**: Google Gemini (text correction).

## Prerequisites

- **Node.js**: v14+ recommended.
- **Python**: v3.8+ (for Whisper).
- **FFmpeg**: Must be installed and available in system PATH.
- **OpenAI Whisper**: `pip install openai-whisper`

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/slimmind/multik.git
    cd multik
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory:
    ```
    GEMINI_API_KEY=your_google_gemini_api_key
    ```

## Development

To run the application in development mode (with hot-reloading for frontend):

1.  Start the backend server (on port 3000):
    ```bash
    npm start
    ```

2.  Start the Vite frontend dev server (on port 5173):
    ```bash
    npm run dev
    ```

   Open `http://localhost:5173` in your browser.

## Production Build

To build the frontend and serve it via the Node.js backend:

1.  Build the React app:
    ```bash
    npm run build
    ```

2.  Start the server (serves the `dist` folder):
    ```bash
    npm start
    ```

   Open `http://localhost:3000` in your browser.

## License

MIT
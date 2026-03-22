#!/bin/bash
set -e

cd /home/slim/Documents/multik

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Optional: Update from git (commented out for autostart)
git pull origin master

# Build if needed
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "Building frontend..."
    bun run build
fi

# Start the server
echo "Starting Multik server..."
bun start

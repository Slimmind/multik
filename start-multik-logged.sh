#!/bin/bash

LOGFILE="$HOME/Documents/multik/multik-startup.log"

{
    echo "=========================================="
    echo "Multik startup started at $(date)"
    echo "=========================================="
    
    cd /home/slim/Documents/multik || { echo "ERROR: Failed to cd to multik directory"; exit 1; }
    
    # Load environment variables if .env exists
    if [ -f .env ]; then
        echo "Loading environment variables from .env"
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Update from git
    echo "Running: git pull origin master"
    git pull origin master || { echo "WARNING: git pull failed"; }
    
    # Build if needed
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        echo "Building frontend..."
        bun run build || { echo "ERROR: build failed"; exit 1; }
    else
        echo "Frontend already built, skipping build"
    fi
    
    # Start the server
    echo "Starting Multik server..."
    bun start
    
    echo "=========================================="
    echo "Multik process ended at $(date)"
    echo "=========================================="
} >> "$LOGFILE" 2>&1

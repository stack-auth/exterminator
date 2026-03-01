#!/bin/sh
# Run the demo app's Vite dev server on port 3000 in the background
cd /code && pnpm dev --port 3000 --host &

# Start the agent server with a virtual display for Playwright video recording
cd /app/agent && exec xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" node src/index.js

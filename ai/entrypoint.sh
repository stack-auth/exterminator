#!/bin/sh
# Run the demo app's Vite dev server on port 3000 in the background
cd /code && pnpm dev --port 3000 --host &

# Start the agent server (foreground)
exec pnpm --dir /app/agent start

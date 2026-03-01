#!/bin/sh
# Serve the demo app on port 3000 in the background
python3 -m http.server 3000 --directory /code &

# Start the agent server (foreground)
exec pnpm --dir /app/agent start

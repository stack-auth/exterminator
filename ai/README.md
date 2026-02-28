# AI Agent

## Production

Build and run the container with the agent code baked in:

```bash
docker build -t exterminator-agent .
docker run exterminator-agent
```

## Development

Use docker-compose to mount `ai/agent` directly into the container so file
changes are reflected immediately (hot reload, no rebuild needed):

```bash
docker compose up
```

The local `agent/` directory is mounted at `/agent` inside the container, so any
edits you make on the host are visible in the running container instantly.

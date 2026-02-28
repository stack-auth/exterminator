# AI Agent

## Production

Build and run the container with the agent code baked in:

```bash
docker build -t exterminator-agent .
docker run exterminator-agent
```

## Development

Use docker-compose to mount `ai/agent` directly into the container. The
`pnpm dev` command uses `node --watch` so file changes restart automatically:

```bash
docker compose up
```

The local `agent/` directory is mounted at `/agent` inside the container, so any
edits you make on the host are visible in the running container instantly.
`node_modules` is kept in a named volume to avoid conflicts with the host.

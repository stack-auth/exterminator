# AI Agent

## Production

Build and run the container with both the agent and runner baked in:

```bash
docker build -t exterminator-agent .
docker run exterminator-agent
```

The default `CMD` starts the Node.js agent (`pnpm start`). To run
runner scripts instead, override the command:

```bash
# create a run
docker run exterminator-agent python3 /app/runner/run_browser_agent.py reproduce --run-id $RUN_ID

# apply a fix
docker run exterminator-agent python3 /app/runner/run_fix.py --run-id $RUN_ID

# validate
docker run exterminator-agent python3 /app/runner/run_browser_agent.py validate --run-id $RUN_ID
```

Pass API keys as environment variables (do **not** bake them into the image):

```bash
docker run \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e BROWSER_USE_API_KEY=bu_... \
  -e APP_URL=http://host.docker.internal:3000 \
  exterminator-agent python3 /app/runner/run_browser_agent.py reproduce --run-id $RUN_ID
```

## Development

Use docker-compose to mount `ai/agent` and `ai/runner` directly into the
container. The `pnpm dev` command uses `node --watch` so file changes restart
automatically:

```bash
docker compose up
```

The local `agent/` directory is mounted at `/app/agent` and `runner/` at
`/app/runner` inside the container, so any edits you make on the host are
visible in the running container instantly. `node_modules` is kept in a named
volume to avoid conflicts with the host.

### Running runner scripts in the dev container

```bash
docker compose exec agent python3 /app/runner/run_browser_agent.py reproduce --run-id $RUN_ID
```

## What's in the image

| Directory      | Runtime | Purpose                                              |
|----------------|---------|------------------------------------------------------|
| `/app/agent`   | Node.js | Core agent code (pnpm)                               |
| `/app/runner`  | Python  | Reproduce / fix / validate pipeline (browser-use, Claude CLI) |

The image also ships with **Playwright + Chromium** and the **Claude CLI**
pre-installed so the runner scripts work out of the box.

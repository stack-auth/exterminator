# AI Agent

## Production

Build and run the container with both the agent server and runner baked in:

```bash
docker build -t exterminator-agent .
docker run -p 4000:4000 -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e BROWSER_USE_API_KEY=bu_... \
  exterminator-agent
```

The container starts two services:

- **Port 3000** — Taskflow demo app (Vite dev server) from `/code`
  ([stack-auth/exterminator-demo-repo](https://github.com/stack-auth/exterminator-demo-repo),
  cloned + `pnpm install` at build time)
- **Port 4000** — control interface + REST API

The control interface on port **4000** exposes:

- **`GET /`** — control interface (dashboard UI)
- **`POST /api/runs`** — start a new bug-fix run
- **`GET /api/runs/current`** — poll the current run state
- **`DELETE /api/runs/current`** — stop & reset the current run
- **`GET /api/runs/:runId`** — fetch any run by ID
- **`GET /api/runs`** — list all runs

See [API_DOCS.md](./API_DOCS.md) for full documentation.

### Running runner scripts directly

You can still invoke the Python scripts manually by overriding the command:

```bash
docker run exterminator-agent python3 /app/runner/run_browser_agent.py reproduce --run-id $RUN_ID
docker run exterminator-agent python3 /app/runner/run_fix.py --run-id $RUN_ID
docker run exterminator-agent python3 /app/runner/run_browser_agent.py validate --run-id $RUN_ID
```

## Development

Use docker-compose to mount `ai/agent` and `ai/runner` directly into the
container. The `pnpm dev` command uses `node --watch` so file changes restart
automatically:

```bash
docker compose kill && docker compose rm && docker compose up --build
```

The dashboard is available at http://localhost:4000 and the demo app at
http://localhost:3000.

The local `agent/` directory is mounted at `/app/agent` and `runner/` at
`/app/runner` inside the container, so any edits you make on the host are
visible in the running container instantly. `node_modules` is kept in a named
volume to avoid conflicts with the host. API keys are loaded from
`runner/.env` via the `env_file` directive in docker-compose.

### Running without Docker

```bash
cd ai/agent
pnpm install
pnpm start        # or: pnpm dev (auto-restart on changes)
```

The server expects the runner at `../runner` relative to `agent/src/`.
Override with the `RUNNER_DIR` environment variable if needed.

## What's in the image

| Directory      | Runtime | Purpose                                              |
|----------------|---------|------------------------------------------------------|
| `/app/agent`   | Node.js | Express server + control UI + pipeline orchestrator  |
| `/app/runner`  | Python  | Reproduce / fix / validate agents (browser-use, Claude CLI) |
| `/code`        | Node.js | Taskflow demo app (Vite dev server on :3000)         |

The image also ships with **Playwright + Chromium** and the **Claude CLI**
pre-installed so the runner scripts work out of the box.

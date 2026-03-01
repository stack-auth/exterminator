# Exterminator

## Structure

```
browser-script/   TypeScript → single JS bundle for <script> tags
dashboard/         Next.js app + Convex DB — error monitoring UI
demo/              Sample app with embedded bugs for end-to-end testing
ai/                AI agent running in Docker
  agent/           Agent source, copied to /agent in the container
```

## Prerequisites

- [pnpm](https://pnpm.io/)
- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) (for the AI agent)

## Browser Script

Bundles TypeScript into a single minified IIFE file at `dist/index.global.js`, ready to be loaded via `<script src="...">`.

```bash
cd browser-script
pnpm install
pnpm build        # one-off build → dist/index.global.js
pnpm dev          # rebuild on file changes
```

## Dashboard

Next.js app backed by [Convex](https://convex.dev/) for storing and viewing captured errors.

### First-time setup

```bash
cd ai && daytona snapshot create exterminator-ai --dockerfile ./Dockerfile  # build daytona snapshot
```

```bash
cd dashboard
pnpm install
npx convex dev          # starts a local Convex backend, generates types, creates .env.local
```

`npx convex dev` will prompt you to either log in or start without an account (local mode). It creates a `.env.local` with `NEXT_PUBLIC_CONVEX_URL` automatically.

### Environment variables

Add the following to `dashboard/.env.local`:

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Auto-created by `npx convex dev` | Convex backend URL |
| `CONVEX_DEPLOYMENT` | Auto-created by `npx convex dev` | Convex deployment name |
| `DAYTONA_API_KEY` | Daytona dashboard | Sandbox creation |
| `NEXT_PUBLIC_STACK_PROJECT_ID` | [Stack Auth dashboard](https://app.stack-auth.com) → project settings | Auth |
| `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` | Stack Auth dashboard → API keys | Auth |
| `STACK_SECRET_SERVER_KEY` | Stack Auth dashboard → API keys | Auth (server-side) |

### Stack Auth + GitHub OAuth

The dashboard uses [Stack Auth](https://stack-auth.com) for authentication and to obtain GitHub OAuth tokens for PR creation.

1. Create a project at [app.stack-auth.com](https://app.stack-auth.com) and copy the three env vars above
2. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers):
   - **Homepage URL**: `http://localhost:[PORT]`
   - **Authorization callback URL**: `https://api.stack-auth.com/api/v1/auth/oauth/callback/github`
3. In the Stack Auth dashboard, go to **Auth Methods** → **GitHub**, switch off shared keys, and paste your GitHub Client ID + Client Secret
4. Sign in at `http://localhost:3000/handler/sign-in` — the "Connect GitHub" button on error entries will then work

### Running

You need **two terminals** — one for Convex, one for Next.js:

```bash
# terminal 1 — Convex backend (keeps schema and functions in sync)
cd dashboard
npx convex dev

# terminal 2 — Next.js dev server
cd dashboard
pnpm dev                # → http://localhost:3002
```

### Architecture

```
Browser Script                Dashboard (Next.js)               Daytona
─────────────                 ───────────────────               ───────
                    POST /api/events
  capture error  ──────────────────────►  store in Convex
                                          (errors table)
                                                │
                                                ▼
                                          Dashboard UI
                                          renders ErrorCard
                                                │
                                     POST /api/sandbox
                                     { errorId, error }
                                                │
                                                ▼
                                          create sandbox  ──────►  Daytona sandbox
                                          store in Convex          created
                                          (sandboxes table)
                                                │
                                          return sandboxId
                                          to frontend
                                                │
                                          fire-and-forget  ─────►  run AI pipeline
                                          runPipeline()            (reproduce → fix
                                                │                   → validate)
                                          status updates  ◄──────  pipeline progress
                                          written to Convex
```

**Error ingestion** — The browser script captures uncaught errors and unhandled rejections, batches them, and POSTs to `/api/events`. This route only writes to Convex and returns immediately.

```
POST /api/events
Content-Type: application/json

{ "events": [ ... ] }
```

Point the browser script at this endpoint:

```html
<script src="exterminator.js" data-endpoint="http://localhost:3002/api/events"></script>
```

**Sandbox creation** — When the dashboard UI mounts an error card, it checks the `sandboxes` table in Convex. If no sandbox exists for that error, the frontend calls `/api/sandbox` with the error data. The route creates a Daytona sandbox, writes a record to Convex, and returns the `sandboxId` to the frontend. The AI pipeline (reproduce, fix, validate) runs fire-and-forget in the background, updating the sandbox status in Convex as it progresses. The frontend reactively picks up these status changes via Convex's real-time queries.

## Demo App

A productivity app ("Planr") with a sidebar, working pages, and a few realistic bugs embedded for testing the full pipeline. The browser script is pre-wired to send errors to the dashboard at `localhost:3002`.

### Running

Make sure the dashboard is running first (see above), then:

```bash
cd demo
pnpm install
pnpm dev                # → http://localhost:5173
```

### Triggering errors

The app works normally until you hit one of these:

| Page | Action | Error |
|---|---|---|
| **Dashboard** | Click **Generate Report** | `TypeError: Cannot read properties of undefined (reading 'format')` — report pipeline calls through 5 nested functions before hitting a node with no `metadata` |
| **Tasks** | Check or uncheck "Write integration tests" | `TypeError: Cannot read properties of null (reading 'join')` — analytics code calls `.join()` on `null` tags |
| **Notes** | Click the **Sync** button on any note | `Unhandled Promise Rejection` — POSTs to a non-existent `/api/notes/sync` endpoint, then tries to parse the HTML error page as JSON |
| **Settings** | Click **Export Data** | `TypeError: Converting circular structure to JSON` — the export object contains a circular reference |

Errors are captured by the browser script and appear in the dashboard in real time.

## AI Agent

All source lives in `ai/agent/` and gets placed at `/agent` inside the container.

### Production

Build an image with the agent code baked in:

```bash
cd ai
docker build -t exterminator-agent .
docker run exterminator-agent
```

### Development

Mount the local `agent/` directory into the container so changes are reflected immediately:

```bash
cd ai
docker compose up
```

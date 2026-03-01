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
cd dashboard
pnpm install
npx convex dev          # starts a local Convex backend, generates types, creates .env.local
```

`npx convex dev` will prompt you to either log in or start without an account (local mode). It creates a `.env.local` with `NEXT_PUBLIC_CONVEX_URL` automatically.

### Running

You need **two terminals** — one for Convex, one for Next.js:

```bash
# terminal 1 — Convex backend (keeps schema and functions in sync)
cd dashboard
npx convex dev

# terminal 2 — Next.js dev server
cd dashboard
pnpm dev                # → http://localhost:3000
```

### How it receives errors

The browser script POSTs captured errors to the dashboard's API route:

```
POST /api/events
Content-Type: application/json

{ "events": [ ... ] }
```

Point the browser script at this endpoint:
```html
<script src="exterminator.js" data-endpoint="http://localhost:3000/api/events"></script>
```

The route stores the events in Convex, and the dashboard UI updates in real time.

## Demo App

A productivity app ("Planr") with a sidebar, working pages, and a few realistic bugs embedded for testing the full pipeline. The browser script is pre-wired to send errors to the dashboard at `localhost:3000`.

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

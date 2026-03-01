# Exterminator

**Autonomous bug detection, reproduction, and fixing for web apps.**

Exterminator watches your frontend for crashes. When one happens, it spins up an isolated cloud sandbox, reproduces the error on video, patches the code, opens a GitHub PR, then validates the fix — all without human intervention.

```
Error crashes your app
       │
       ▼
Browser script captures it → Dashboard ingests it
       │
       ▼
Daytona sandbox spins up
       │
       ├─ [Reproduce agent]  navigates the app, confirms the crash (video)
       ├─ [Fix agent]        reads source, patches the bug, opens a PR
       └─ [Validate agent]   re-runs the app, confirms fix + no regressions (video)
```

---

## Repo structure

```
browser-script/   TypeScript → single JS bundle for <script> tags
dashboard/        Next.js + Convex — error monitoring UI and pipeline orchestrator
demo/             Sample React app (Planr) with realistic bugs for end-to-end testing
ai/
  agent/          Node.js agent server running inside the Daytona sandbox
  runner/         Python pipeline: reproduce → fix → validate
  Dockerfile      Image baked with the agent, demo app clone, and all deps
  entrypoint.sh   Pulls latest demo code, starts Vite dev server + agent server
  create-snapshot.ts  Builds and registers a new Daytona snapshot
```

---

## Quick start

### 1. Dashboard

```bash
cd dashboard
pnpm install

# Start local Convex backend (generates .env.local automatically)
npx convex dev

# In a second terminal, start Next.js
pnpm dev -p 3003     # → http://localhost:3003
```

Add the following to `dashboard/.env.local`:

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Auto-created by `npx convex dev` | Convex backend URL |
| `CONVEX_DEPLOYMENT` | Auto-created by `npx convex dev` | Convex deployment name |
| `DAYTONA_API_KEY` | [Daytona dashboard](https://app.daytona.io) | Sandbox creation |
| `ANTHROPIC_API_KEY` | [Anthropic console](https://console.anthropic.com) | Fix agent (Claude) |
| `NEXT_PUBLIC_STACK_PROJECT_ID` | [Stack Auth](https://app.stack-auth.com) → project settings | Auth |
| `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` | Stack Auth → API keys | Auth |
| `STACK_SECRET_SERVER_KEY` | Stack Auth → API keys | Auth (server-side) |

### 2. Demo app

```bash
cd demo
pnpm install
pnpm dev     # → http://localhost:3001
```

The demo app (`Planr`) ships with realistic bugs. The browser script is pre-configured to send errors to the dashboard. Trigger a bug by clicking on a task with no due date — the detail panel will crash with `TypeError: Cannot read properties of null (reading 'split')`.

### 3. Browser script

To wire up your own app, add to your `index.html`:

```html
<script src="exterminator.js" data-endpoint="http://localhost:3003/api/events"></script>
```

To rebuild the script from source:

```bash
cd browser-script
pnpm install
pnpm build     # → dist/index.global.js
```

---

## Authentication (Stack Auth + GitHub OAuth)

The dashboard uses [Stack Auth](https://stack-auth.com) for auth and to obtain GitHub tokens for PR creation.

1. Create a project at [app.stack-auth.com](https://app.stack-auth.com) and copy the three env vars above
2. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers):
   - **Homepage URL**: `http://localhost:3003`
   - **Authorization callback URL**: `https://api.stack-auth.com/api/v1/auth/oauth/callback/github`
3. In Stack Auth → **Auth Methods** → **GitHub**, paste your Client ID + Secret
4. Sign in at `http://localhost:3003/handler/sign-in`

---

## Daytona snapshot

The AI pipeline runs inside a Daytona sandbox built from `ai/Dockerfile`. The snapshot is pre-baked with Python, Node, pnpm, ffmpeg, Playwright, and a clone of the demo repo.

To build a new snapshot (replaces the existing one — coordinate with the team first):

```bash
cd ai
pnpm install
DAYTONA_API_KEY=... npx tsx create-snapshot.ts
```

The snapshot name defaults to `exterminator-ai-8` and is configurable via `DAYTONA_SNAPSHOT_NAME` in `dashboard/.env.local`.

---

## How the pipeline works

1. **Browser script** captures uncaught errors and unhandled rejections, batches them, and POSTs to `POST /api/events`.
2. **Dashboard** stores the error in Convex. The UI renders an error card and automatically calls `POST /api/sandbox` to spin up a Daytona sandbox.
3. **Reproduce agent** (`browser-use` + Python) navigates the live app inside the sandbox, confirms the crash, and records a video.
4. **Fix agent** (`claude-code` SDK) reads the source files implicated in the stack trace and applies a targeted patch. If a previous fix introduced a regression, the agent receives that context and tries again.
5. **Validate agent** (`browser-use` + Python) re-runs the app, confirms the original crash is gone, performs a full regression sweep across all pages, and records a video. If a new error is found, the loop repeats from step 4.
6. On success, the fix agent opens a **GitHub PR** with the patched files.

All progress is written to Convex in real time and streamed to the dashboard UI.

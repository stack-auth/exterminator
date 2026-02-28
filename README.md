# Exterminator

## Structure

```
browser-script/   TypeScript → single JS bundle for <script> tags
backend/           Backend service (coming soon)
ai/                AI agent running in Docker
  agent/           Agent source, copied to /agent in the container
```

## Prerequisites

- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for the AI agent)

## Browser Script

Bundles TypeScript into a single minified IIFE file at `dist/index.global.js`, ready to be loaded via `<script src="...">`.

```bash
cd browser-script
pnpm install
pnpm build        # one-off build → dist/index.global.js
pnpm dev          # rebuild on file changes
```

## Backend

Nothing here yet.

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

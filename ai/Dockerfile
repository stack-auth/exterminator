FROM node:22-slim

# Python + system deps needed by Playwright later
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# pnpm + Claude CLI
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g @anthropic-ai/claude-code

# --- Agent (Node.js) ---
WORKDIR /app/agent

COPY agent/package.json agent/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY agent/ .

# --- Runner (Python) ---
WORKDIR /app/runner

COPY runner/requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY runner/ .

WORKDIR /app

CMD ["pnpm", "--dir", "agent", "start"]

FROM node:22-slim

# Python + git + ffmpeg + xvfb + system deps needed by Playwright
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip git ffmpeg xvfb xauth \
    && rm -rf /var/lib/apt/lists/*

# pnpm + Claude CLI
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g @anthropic-ai/claude-code

# --- Runner (Python) ---
WORKDIR /app/runner

COPY runner/requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir -r requirements.txt
RUN playwright install chromium
RUN playwright install --with-deps chromium

# --- Agent (Node.js) ---
WORKDIR /app/agent

COPY agent/package.json agent/pnpm-lock.yaml* ./
RUN echo 'node-linker=hoisted' > .npmrc && pnpm install --frozen-lockfile || pnpm install


# -- Copy runner and agent code (do this last for better caching) --
COPY runner/ /app/runner
COPY agent/ /app/agent

# --- Demo app (Vite dev server on port 3000) ---
RUN echo 1
RUN git clone https://github.com/stack-auth/exterminator-demo-repo.git /code
WORKDIR /code
RUN pnpm install

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]

FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /agent

COPY agent/package.json agent/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY agent/ .

CMD ["pnpm", "start"]

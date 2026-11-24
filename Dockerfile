# syntax=docker/dockerfile:1.7
# Web app image (target "web") and a one-off migration image (target "migrate").
# Build both with `docker compose -f docker-compose.prod.yml build`; see
# docs/DEPLOYMENT.md.

ARG NODE_IMAGE=node:24-bookworm-slim

# ── Dependencies (full, including dev tools for the build and migrations) ──
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Build ──────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Migrations and demo seed: runs once per deploy, then exits ────────────
FROM deps AS migrate
COPY . .
ENV NODE_ENV=production
USER node
# SEED_DEMO=true also loads the fictional demo catalogue (repeatable; keeps
# existing records).
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && if [ \"$SEED_DEMO\" = \"true\" ]; then npx tsx scripts/seed.ts; fi"]

# ── Web: the standalone Next.js server only ───────────────────────────────
FROM ${NODE_IMAGE} AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

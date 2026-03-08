# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install dependencies with lockfile from the monorepo root.
# Build context is the MONOREPO ROOT so we can reach bun.lock.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS deps

WORKDIR /app

COPY bun.lock ./
COPY apps/frontend/package.json ./

RUN bun install


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
# Build the Vite production bundle.
# VITE_* env vars must be available at build time (ARG → ENV).
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend/ .

# Accept build-time env vars so Vite can inline them
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_GOOGLE_CLIENT_ID

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN bun run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime
# Serve static files with nginx.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS runtime

# Copy built assets to nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback — route all paths to index.html so React Router works
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

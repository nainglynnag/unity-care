# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install production + dev dependencies with lockfile.
# Build context is the MONOREPO ROOT so we can reach bun.lock.
# Separated so Docker cache reuses this layer as long as
# package.json and bun.lock don't change.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy lockfile from monorepo root + backend package.json
COPY bun.lock ./
COPY apps/backend/package.json ./

RUN bun install


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
# Generate Prisma client, then compile TypeScript to dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy Prisma schema first — prisma generate only needs this file
COPY apps/backend/prisma ./prisma

# Generate Prisma client into generated/prisma
# (output path is relative to schema.prisma, so generated/ lands at /app/generated/)
RUN bunx prisma generate

# Copy the rest of the backend source
COPY apps/backend/ .

# Compile TypeScript → dist/
# --external bcrypt: bcrypt uses native C++ bindings (.node files)
# that cannot be bundled — they must be loaded from node_modules at runtime.
RUN bun build src/server.ts --outdir dist --target bun --external bcrypt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime
# Lean image — only what the server needs to run.
# No TypeScript compiler, no dev tooling.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runtime

WORKDIR /app

# Reuse node_modules from deps stage (already verified against lockfile).
# A separate --production install fails here because the monorepo bun.lock
# references workspaces that don't exist in this container.
COPY --from=deps /app/node_modules ./node_modules

# Production artefacts only
COPY --from=builder /app/dist              ./dist
COPY --from=builder /app/generated         ./generated
COPY --from=builder /app/prisma            ./prisma
COPY --from=builder /app/prisma.config.ts  ./prisma.config.ts
COPY --from=builder /app/package.json      ./package.json

# Port the Express + WS server listens on (matches PORT in .env)
EXPOSE 3000

# 1. Run pending migrations against the real DB  (prisma migrate deploy)
#    — safe to run on every container start; skips already-applied migrations
# 2. Start the server
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run dist/server.js"]

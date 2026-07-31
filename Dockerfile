# Use the official Bun image
# See all versions at https://hub.docker.com/r/oven/bun/tags
# Pinned (not floating `oven/bun:1`) to match CI's BUN_VERSION exactly.
FROM oven/bun:1.3.5 AS base
WORKDIR /usr/src/app

# Install the full (dev + prod) dependency tree — needed to build the client
# and generate the Prisma client for the build-time typecheck below.
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
COPY client/package.json /temp/dev/client/
COPY server/package.json /temp/dev/server/
COPY packages/core/package.json /temp/dev/packages/core/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Install only the production dependency tree, for the release layer. A
# separate install (not a prune of the dev tree) because Bun links each
# generated Prisma client into a hash-keyed path under node_modules/.bun that
# is tied to the exact dependency set it was installed with.
FROM base AS install-prod
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
COPY client/package.json /temp/prod/client/
COPY server/package.json /temp/prod/server/
COPY packages/core/package.json /temp/prod/packages/core/
RUN cd /temp/prod && bun install --frozen-lockfile --ignore-scripts --production

# Copy dependencies and source code, then build
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Generate Prisma Client — also acts as a schema-validity gate before the
# (slower) client build runs.
RUN cd server && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

# Build the client and server
RUN bun run build

# Bake the MiniLM embedding weights into the image at build time. Without
# this, the model downloads from the HF Hub on the first ticket after every
# deploy — fine on a persistent disk, wrong on an ephemeral container
# filesystem, where it means every deploy pays an 87 MB download.
ENV MODEL_CACHE_DIR=/models
RUN mkdir -p /models && bun server/scripts/prefetch-model.ts

# Release image — production dependencies only, no build tooling.
FROM base AS release
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_ROLE=all

COPY --from=install-prod /temp/prod/node_modules node_modules
COPY --from=build /usr/src/app/client/dist client/dist
COPY --from=build /usr/src/app/server server
COPY --from=build /usr/src/app/packages packages
COPY --from=build /models /models
COPY package.json bun.lock ./

# The client above was generated against the dev dependency tree, which lives
# at a different hash-keyed path than the production tree just installed —
# regenerate against this image's actual node_modules.
RUN cd server && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

ENV MODEL_CACHE_DIR=/models
# The image already has the weights baked in (see the build stage above); a
# missing model at runtime should fail loudly, not silently phone home to the
# HF Hub from inside a container that may have no outbound network access.
ENV ALLOW_REMOTE_MODELS=false

USER bun
EXPOSE 3000/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["bun", "server/scripts/healthcheck.ts"]

# Exec form (not "sh -c") so Bun is PID 1 and receives SIGTERM directly —
# migrations run as a separate compose/Helm step, not from here.
CMD ["bun", "server/src/index.ts"]

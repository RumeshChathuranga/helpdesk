# Pinned (not floating `oven/bun:1`) to match CI's BUN_VERSION exactly.
FROM oven/bun:1.3.5 AS base
WORKDIR /usr/src/app

# Full dev+prod tree — needed to build the client and generate Prisma client.
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
COPY client/package.json /temp/dev/client/
COPY server/package.json /temp/dev/server/
COPY packages/core/package.json /temp/dev/packages/core/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Separate install (not a prune of the dev tree) — Bun links each generated
# Prisma client into a hash-keyed path tied to its exact dependency set.
FROM base AS install-prod
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
COPY client/package.json /temp/prod/client/
COPY server/package.json /temp/prod/server/
COPY packages/core/package.json /temp/prod/packages/core/
RUN cd /temp/prod && bun install --frozen-lockfile --ignore-scripts --production

FROM base AS build
# Bun workspaces don't hoist — the root tree alone leaves prisma, express and
# vite unresolvable from their workspace.
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=install /temp/dev/client/node_modules client/node_modules
COPY --from=install /temp/dev/server/node_modules server/node_modules
COPY --from=install /temp/dev/packages/core/node_modules packages/core/node_modules
COPY . .

# Generate Prisma Client — also acts as a schema-validity gate before the
# (slower) client build runs.
RUN cd server && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

RUN bun run build

# Bake the MiniLM weights in at build time — otherwise every deploy on an
# ephemeral filesystem re-downloads 87 MB from the HF Hub on the first ticket.
ENV MODEL_CACHE_DIR=/models
RUN mkdir -p /models && bun server/scripts/prefetch-model.ts

# Release installs its own prod tree at different .bun hashes, so these dev
# symlinks would dangle if they came along.
RUN rm -rf client/node_modules server/node_modules packages/core/node_modules

FROM base AS release
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_ROLE=all

# Debian security updates on top of the pinned base — the CI Trivy gate fails
# on any fixable CRITICAL, and the base image lags Debian's openssl fixes.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

COPY --from=install-prod /temp/prod/node_modules node_modules
COPY --from=build /usr/src/app/client/dist client/dist
COPY --from=build /usr/src/app/server server
COPY --from=build /usr/src/app/packages packages
# Same non-hoisting rule, prod tree this time.
COPY --from=install-prod /temp/prod/server/node_modules server/node_modules
COPY --from=install-prod /temp/prod/packages/core/node_modules packages/core/node_modules
COPY --from=build /models /models
COPY package.json bun.lock ./

# Bun's --production only prunes the root package's devDependencies, not a
# workspace's, so esbuild's unused Go binary lands in the prod tree and trips Trivy.
RUN rm -rf node_modules/.bun/*esbuild*

# Client was generated against the dev tree's hash-keyed path; regenerate
# against this image's actual (prod) node_modules.
RUN cd server && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

ENV MODEL_CACHE_DIR=/models
# Weights are already baked in — fail loudly rather than phone home to the HF Hub.
ENV ALLOW_REMOTE_MODELS=false

USER bun
EXPOSE 3000/tcp
# Prometheus scrape port, kept separate so nothing routing the API port reaches it.
EXPOSE 9464/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["bun", "server/scripts/healthcheck.ts"]

# Exec form (not "sh -c") so Bun is PID 1 and receives SIGTERM directly —
# migrations run as a separate compose/Helm step, not from here.
CMD ["bun", "server/src/index.ts"]

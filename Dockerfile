# Use the official Bun image
# See all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies into a temp directory to cache them
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
COPY client/package.json /temp/dev/client/
COPY server/package.json /temp/dev/server/
COPY packages/core/package.json /temp/dev/packages/core/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Copy dependencies and source code, then build
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Generate Prisma Client
RUN cd server && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx prisma generate

# Build the client and server
RUN bun run build

# Release image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /usr/src/app .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

USER bun
EXPOSE 3000/tcp

# Run migrations and start the server
CMD ["sh", "-c", "bun run db:migrate:deploy && bun run start"]

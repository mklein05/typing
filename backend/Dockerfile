# syntax=docker/dockerfile:1

# ─── build stage ───────────────────────────────────────────────────────────
# better-sqlite3 is a native addon, so it is installed here where the build
# tooling lives. Building inside the same Debian/Node 22 base as the runtime
# stage is the whole point: the compiled binary matches the runtime's libc and
# Node ABI. `npm ci` on a Windows host would produce a PE binary that cannot
# load here.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Only needed if better-sqlite3 has no prebuilt binary for this platform and
# Node ABI. Kept out of the runtime stage so the shipped image stays small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Manifests first, so editing source does not re-run the native install.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── runtime stage ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8000 \
    DB_PATH=/data/typing_test.db

WORKDIR /app

# /data is the persistent volume mount point (an EBS volume on EC2). Created
# and owned by the unprivileged user so the app can write the database when the
# container runs without a mounted volume.
RUN mkdir -p /data && chown node:node /data

COPY --from=build /app/node_modules ./node_modules
COPY . .

# Run as the image's unprivileged user (uid 1000).
USER node

EXPOSE 8000

# The app exposes no /health route, but GET / returns 200 JSON. Bound to
# loopback so the check never touches a public interface.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# index.js is the entrypoint; `npm start` runs the same command.
CMD ["node", "index.js"]

# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────────────
# Nitro bundles its own dependencies into .output, so nothing from node_modules
# needs to survive into the runtime image.
FROM node:24-alpine AS build

WORKDIR /app

# Dependencies first: this layer is reused on every build that doesn't change
# the lockfile. `--ignore-scripts` skips `nuxt prepare`, which needs the sources.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
# Plain Alpine with the node binary copied in, not `node:24-alpine`.
#
# Nitro bundles its own dependencies into `.output`, so the runtime never
# installs anything — npm, corepack, yarn and the C++ addon headers are ~28 MB
# that exist only to build something. Deleting them in a `RUN` does not help:
# the bytes stay in the base image's layers and the whiteouts make the image
# marginally larger. Not inheriting those layers is the only thing that works.
#
# This must track `node:24-alpine`'s own base, because the node binary is linked
# against that Alpine's musl. `docker run --rm node:24-alpine cat
# /etc/alpine-release` says which.
FROM alpine:3.24 AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    PORT=3000

# The site calls GitHub and crates.io at request time: a missing CA bundle is a
# TLS failure at runtime rather than an error at build, and without tzdata every
# "updated 3 hours ago" is computed against UTC. libstdc++ brings libgcc with
# it; those two and musl are everything `ldd` says node needs.
RUN apk add --no-cache ca-certificates tzdata libstdc++ \
  && addgroup -S site && adduser -S -G site site

COPY --from=build /usr/local/bin/node /usr/local/bin/node

COPY --from=build --chown=site:site /app/.output ./.output

USER site
EXPOSE 3000

# Nitro serves /healthz from server/routes/healthz.get.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]

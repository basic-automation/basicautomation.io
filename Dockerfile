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

# ── Onion gateway build ──────────────────────────────────────────────────────
# Independent of the node stage above, so BuildKit runs the two concurrently.
#
# The musl target links statically by default, which is the point: the result
# drops into the bare Alpine runtime with nothing to install beside it, and the
# runtime keeps no Rust toolchain.
FROM rust:1-alpine AS onion-build

# arti's tree compiles C in three places — ring, libsqlite3-sys and zstd-sys —
# so a C toolchain is not optional. None of it reaches the runtime image.
RUN apk add --no-cache build-base

WORKDIR /src

COPY onion/Cargo.toml onion/Cargo.lock onion/rust-toolchain.toml ./
COPY onion/src ./src

# `--locked` so a dependency cannot drift between a local build and this one:
# the thing being built holds an onion identity key.
#
# The cache mounts survive between builds but not into the image, so the binary
# is copied out of the target directory inside the same RUN — after the mount
# goes away there is nothing left to copy.
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/src/target,sharing=locked \
    cargo build --release --locked \
 && cp target/release/basicautomation-onion /usr/local/bin/onion-gateway

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
    PORT=3000 \
    ONION_ENABLED=1

# The site calls GitHub and crates.io at request time: a missing CA bundle is a
# TLS failure at runtime rather than an error at build, and without tzdata every
# "updated 3 hours ago" is computed against UTC. libstdc++ brings libgcc with
# it; those two and musl are everything `ldd` says node needs.
RUN apk add --no-cache ca-certificates tzdata libstdc++ \
  && addgroup -S site && adduser -S -G site site

COPY --from=build /usr/local/bin/node /usr/local/bin/node

COPY --from=build --chown=site:site /app/.output ./.output

COPY --from=onion-build /usr/local/bin/onion-gateway ./onion-gateway
COPY --chown=site:site docker-entrypoint.sh ./docker-entrypoint.sh

# `/app/tor` holds the onion identity key and is the volume mount point: Docker
# seeds a fresh named volume from the image, ownership and mode included, so
# creating it here is what makes it writable by an unprivileged process later.
# 0700 because arti refuses to launch with a group-readable keystore — and it is
# right to. `/run/onion` is where the gateway publishes its address for the site
# to read back; both processes are this user, so nothing wider is needed.
#
# NOTE: do not "fix" a permission complaint from arti with
# ARTI_FS_DISABLE_PERMISSION_CHECKS. It turns off a real check on the directory
# holding the identity key. Fix the directory.
RUN mkdir -p /app/tor /run/onion \
 && chown site:site /app/tor /run/onion \
 && chmod 700 /app/tor /run/onion

USER site

# 3000 only. The onion service is not a listening port: arti dials out and the
# service is reached through the Tor network, so there is nothing here to map.
EXPOSE 3000

# Nitro serves /healthz from server/routes/healthz.get.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Two processes, one container. See docker-entrypoint.sh for why.
CMD ["./docker-entrypoint.sh"]

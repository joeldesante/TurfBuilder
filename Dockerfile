# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# Puppeteer's own Chrome is built for glibc and cannot run on Alpine; the
# runtime stages install Alpine's chromium instead (see below).
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm install

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run prepare && NODE_OPTIONS=--max-old-space-size=4096 npm run build && npm prune --omit=dev

# --- Development stage ---
# Source is mounted via volume at runtime — do not COPY . here.
# npm install runs at container startup (not build time) so native binaries
# are always resolved for linux/arm64-musl, never inherited from the Mac host.
FROM node:22-alpine AS development
WORKDIR /app

# Headless Chrome for the PDF and map engines. Alpine's build, because
# Puppeteer's bundled Chrome is glibc-only. mesa-egl is the software WebGL
# the map engine renders with (this chromium has no SwiftShader). The fonts
# give rendered pages real glyphs instead of empty boxes.
RUN apk add --no-cache chromium mesa-egl nss freetype harfbuzz ca-certificates ttf-freefont font-noto
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_ENV=development

EXPOSE 5173

CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]

# --- Production stage ---
FROM node:22-alpine AS production
WORKDIR /app

# Headless Chrome for the PDF and map engines. Alpine's build, because
# Puppeteer's bundled Chrome is glibc-only. mesa-egl is the software WebGL
# the map engine renders with (this chromium has no SwiftShader). The fonts
# give rendered pages real glyphs instead of empty boxes.
RUN apk add --no-cache chromium mesa-egl nss freetype harfbuzz ca-certificates ttf-freefont font-noto
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY package.json package-lock.json* ./

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "build"]

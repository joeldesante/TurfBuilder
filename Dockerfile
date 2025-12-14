# --------------------------
# Builder stage
# --------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build SvelteKit
RUN npm run build

# --------------------------
# Production stage
# --------------------------
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci

# Copy build output
COPY --from=builder /app/.svelte-kit/output ./.svelte-kit/output
COPY --from=builder /app/static ./static

ENV NODE_ENV=production

# Create a small start script to respect Dokku's PORT
RUN echo "process.env.PORT = process.env.PORT || 3000;\nimport('./.svelte-kit/output/server/index.js');" > start.js

# Run app via the start script
CMD ["node", "start.js"]

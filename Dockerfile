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
COPY --from=builder /app/build
COPY --from=builder /app/static ./static

ENV NODE_ENV=production

# Run app via the start script
CMD ["node", "-r", "dotenv/config", "build"]

# --------------------------
# Builder stage
# --------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# --------------------------
# Production stage
# --------------------------
FROM node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy SvelteKit build output
COPY --from=builder /app/.svelte-kit/output ./.svelte-kit/output
COPY --from=builder /app/static ./static

ENV NODE_ENV=production
EXPOSE 3000

# Start the server
CMD ["node", ".svelte-kit/output/server/app.js"]

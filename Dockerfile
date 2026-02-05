# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and clean cache
RUN npm ci --only=production=false && \
    npm cache clean --force

# Copy source code
COPY . .

# Build with memory constraints and production mode
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build && \
    rm -rf node_modules

# --- Development stage ---
FROM node:22-alpine AS development
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Set development environment
ENV NODE_ENV=development

# Expose Vite dev server port
EXPOSE 5173

# Start dev server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Production stage ---
FROM node:22-alpine AS production
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built app from builder
COPY --from=builder /app/build ./build
COPY package.json .

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose production port
EXPOSE 3000

# Start the server
CMD ["node", "build"]
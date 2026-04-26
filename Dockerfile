# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Only copy production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
USER node

# Expose port (used by API)
EXPOSE 3000

# Default command (API). Worker will override this in docker-compose
CMD ["node", "dist/index.js"]

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/api-gateway/package*.json ./services/api-gateway/

# Install dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY services/api-gateway/ ./services/api-gateway/
COPY tsconfig.json ./

# Build all packages
RUN npm run build --workspace=@heuresys/shared
RUN npm run build --workspace=@heuresys/api-gateway

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 heuresys

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/api-gateway/package*.json ./services/api-gateway/

# Install production dependencies only
RUN npm ci --workspaces --include-workspace-root --omit=dev

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

# Switch to non-root user
USER heuresys

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
WORKDIR /app/services/api-gateway
CMD ["node", "dist/index.js"]

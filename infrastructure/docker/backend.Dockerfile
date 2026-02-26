FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root and shared package
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Install dependencies
RUN npm install --workspace=@wizqueue/shared --workspace=@wizqueue/backend

# Build shared types
RUN npm run build -w @wizqueue/shared

# Build backend
RUN npm run build -w @wizqueue/backend

# Copy static assets into dist
RUN cp -r /app/packages/backend/src/assets /app/packages/backend/dist/assets 2>/dev/null || true

# Production image
FROM node:22-alpine

# Install poppler-utils for PDF processing
RUN apk add --no-cache poppler-utils

WORKDIR /app

# Copy workspace root
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy built packages and node_modules from builder
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/migrations ./packages/backend/migrations
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Health check (every 5 minutes to reduce log noise)
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start server
CMD ["node", "packages/backend/dist/index.js"]

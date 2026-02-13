FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root and shared package
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Install dependencies
RUN npm install --workspace=@wizqueue/shared --workspace=@wizqueue/backend

# Build shared types
RUN npm run build -w @wizqueue/shared

# Build backend
RUN npm run build -w @wizqueue/backend

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy workspace root
COPY package*.json ./

# Copy built packages
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/migrations ./packages/backend/migrations

# Install production dependencies only
RUN npm install --workspace=@wizqueue/shared --workspace=@wizqueue/backend --omit=dev

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start server
CMD ["node", "packages/backend/dist/index.js"]

FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root and packages
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

# Install dependencies
RUN npm install --workspace=@wizqueue/shared --workspace=@wizqueue/frontend

# Build shared types
RUN npm run build -w @wizqueue/shared

# Build frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @wizqueue/frontend

# Production image with nginx
FROM nginx:alpine

# Copy nginx config
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

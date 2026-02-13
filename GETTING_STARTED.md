# Getting Started with WizQueue

This guide will walk you through setting up and running WizQueue locally for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>= 18.0.0) - [Download](https://nodejs.org/)
- **npm** (>= 9.0.0) - Comes with Node.js
- **PostgreSQL** (>= 14) - [Download](https://www.postgresql.org/download/)
- **Ollama** - [Download](https://ollama.ai/)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo (backend, frontend, and shared).

### 2. Set Up Database

Create a PostgreSQL database and user:

```sql
CREATE DATABASE wizqueue;
CREATE USER wizqueue_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE wizqueue TO wizqueue_user;
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=wizqueue
DATABASE_USER=wizqueue_user
DATABASE_PASSWORD=your_password

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava:latest

# Application
NODE_ENV=development
PORT=3000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Frontend
VITE_API_URL=http://localhost:3000/api
```

### 4. Run Database Migrations

```bash
npm run migrate
```

This will create the necessary tables (`invoices`, `queue_items`, and `migrations`).

### 5. Set Up Ollama

Start Ollama and pull the vision model:

```bash
# Start Ollama (in a separate terminal)
ollama serve

# Pull the vision model (in another terminal)
ollama pull llava
```

Available models:
- `minicpm-v:8b` - Excellent for invoices/documents (recommended) ⭐
- `llava:latest` - Fast and accurate
- `llama3.2-vision:latest` - Better accuracy, slower
- `llava:13b` - Highest quality, requires more RAM

### 6. Start Development Servers

Start both backend and frontend in development mode:

```bash
npm run dev
```

Or start them separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Development Workflow

### Project Structure

```
wizqueue/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── config/       # Database, Ollama config
│   │   │   ├── controllers/  # Request handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── models/       # Database models
│   │   │   ├── routes/       # API routes
│   │   │   └── middleware/   # Express middleware
│   │   └── migrations/       # SQL migrations
│   ├── frontend/         # React application
│   │   └── src/
│   │       ├── components/   # React components
│   │       ├── hooks/        # Custom React hooks
│   │       ├── services/     # API client
│   │       └── styles/       # CSS styles
│   └── shared/          # Shared TypeScript types
│       └── src/types/
└── infrastructure/      # Docker configs
```

### Making Changes

#### Backend Changes

1. Edit files in `packages/backend/src/`
2. Server will auto-reload with `tsx watch`
3. Test endpoints with curl or Postman

Example: Adding a new endpoint
```typescript
// packages/backend/src/routes/example.routes.ts
import { Router } from 'express';

const router = Router();

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
});

export default router;
```

#### Frontend Changes

1. Edit files in `packages/frontend/src/`
2. Vite will hot-reload changes automatically
3. View in browser at http://localhost:5173

#### Shared Types

When adding new types:

1. Edit files in `packages/shared/src/types/`
2. Build shared package: `npm run build -w @wizqueue/shared`
3. Both frontend and backend will have access to new types

### Common Tasks

#### Add a New Package Dependency

```bash
# Backend
npm install <package> -w @wizqueue/backend

# Frontend
npm install <package> -w @wizqueue/frontend

# Shared
npm install <package> -w @wizqueue/shared
```

#### Create a New Database Migration

1. Create a new `.sql` file in `packages/backend/migrations/`
2. Name it with incrementing number: `003_description.sql`
3. Run migrations: `npm run migrate`

#### Build for Production

```bash
npm run build
```

This builds all packages:
- Backend: Transpiles TypeScript to JavaScript in `dist/`
- Frontend: Creates optimized bundle in `dist/`
- Shared: Compiles types to `dist/`

#### Clean Build Artifacts

```bash
npm run clean
```

## Testing the Application

### 1. Upload a Test Invoice

1. Open http://localhost:5173
2. Click "Upload Invoice" tab
3. Drop a PDF invoice or click "Select PDF File"
4. Wait for AI processing (may take 30-60 seconds)
5. Review extracted products
6. Click "Add to Queue"

### 2. Manage Queue

1. Go to "Queue" tab
2. Drag and drop items to reorder
3. Click "Edit" to modify item details
4. Change status with dropdown
5. Click "Delete" to remove items

### 3. Test API Directly

```bash
# Check health
curl http://localhost:3000/health

# Get queue items
curl http://localhost:3000/api/queue

# Create queue item
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Item",
    "details": "Red PLA, 20% infill",
    "quantity": 2
  }'
```

## Troubleshooting

### Database Connection Failed

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql  # Linux
brew services list                 # macOS
```

Verify credentials in `.env` match your database setup.

### Ollama Not Connected

Ensure Ollama is running:
```bash
ollama serve
```

Check model is installed:
```bash
ollama list
```

If missing, pull it:
```bash
ollama pull llava
```

### Port Already in Use

If port 3000 or 5173 is taken:

Backend:
```bash
PORT=3001 npm run dev:backend
```

Frontend - Edit `packages/frontend/vite.config.ts`:
```typescript
server: {
  port: 5174,  // Change port
}
```

### TypeScript Errors

Rebuild shared types:
```bash
npm run build -w @wizqueue/shared
```

### Upload Not Working

1. Check `uploads/` directory exists and is writable
2. Verify Ollama is running and has the model
3. Check backend logs for errors

## Next Steps

- Read the [Implementation Plan](./plan.md) for architecture details
- Check [infrastructure/README.md](./infrastructure/README.md) for deployment
- Explore the codebase and make it your own!

## Development Tips

1. **Use the TypeScript types** - They're shared between frontend and backend
2. **Check the backend logs** - They show SQL queries and Ollama responses
3. **Use React Query DevTools** - Great for debugging API calls
4. **Test with different invoices** - AI extraction varies by format
5. **Monitor Ollama memory** - Vision models use 4-8GB RAM

## Getting Help

- Check logs: `npm run dev` shows both frontend and backend logs
- Database issues: Check `packages/backend/migrations/`
- API issues: Test with curl or Postman
- Frontend issues: Check browser console

Happy coding! 🚀

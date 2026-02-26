# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (from root)
npm install

# Development (runs both backend and frontend concurrently)
npm run dev

# Run only backend or frontend
npm run dev:backend
npm run dev:frontend

# Build
npm run build          # Both packages
npm run build:backend
npm run build:frontend

# Database migrations
npm run migrate        # Runs packages/backend/migrations/run-migrations.js

# Production (after build)
cd packages/backend && node dist/index.js

# Docker deployment
docker compose up -d
```

There are no test scripts defined. Backend uses `tsx watch` for development hot-reload.

## Architecture

This is a **npm workspaces monorepo** with three packages:

- `packages/shared` — TypeScript types only (`QueueItem`, `Invoice`, `ExtractedProduct`, `ApiResponse`, etc.), consumed by both backend and frontend as `@wizqueue/shared`
- `packages/backend` — Express + TypeScript API server (ESM modules, `"type": "module"`)
- `packages/frontend` — React + Vite + TypeScript + Tailwind CSS SPA

### Backend (`packages/backend/src/`)

- `index.ts` — Express app setup, startup health checks for DB and Ollama
- `config/` — Database (pg Pool) and Ollama (axios client) configuration
- `routes/` — `queue.routes.ts`, `upload.routes.ts`
- `controllers/` — `queue.controller.ts`, `upload.controller.ts`
- `services/` — `queue.service.ts` (DB queries), `ollama.service.ts` (LLM extraction), `pdf.service.ts` (PDF→image conversion)
- `middleware/` — Error handler
- `migrations/` — Raw SQL files run via `run-migrations.js`

**PDF processing flow:** PDF upload → `pdf.service.ts` converts pages to base64 images → `ollama.service.ts` sends each image to Ollama vision model with a structured JSON prompt → extracted products returned as `ExtractedProduct[]` → saved as queue items.

**API endpoints:**
- `GET/POST /api/queue` — List/create queue items
- `GET/PUT/DELETE /api/queue/:id` — Single item operations
- `POST /api/queue/batch` — Batch create
- `PATCH /api/queue/reorder` — Drag-and-drop reorder
- `PATCH /api/queue/:id/status` — Status update
- `POST /api/upload` — PDF invoice upload (multipart)
- `GET /api/upload/:id` — Invoice processing status
- `GET/POST /api/customers` — List/create customers
- `GET/PUT/DELETE /api/customers/:id` — Single customer operations
- `GET/POST /api/sales-invoices` — List/create sales invoices
- `GET/PUT/DELETE /api/sales-invoices/:id` — Single invoice operations
- `POST /api/sales-invoices/:id/line-items` — Add line item
- `PUT/DELETE /api/sales-invoices/:id/line-items/:itemId` — Update/delete line item
- `POST /api/sales-invoices/:id/send` — Generate PDF + send email
- `POST /api/sales-invoices/:id/send-to-queue` — Push line items to print queue
- `GET /api/sales-invoices/:id/pdf` — Download PDF
- `GET /health` — DB + Ollama connectivity check

### Frontend (`packages/frontend/src/`)

- `App.tsx` — Root component with `BrowserRouter` and route definitions
- `services/api.ts` — Axios client (`queueApi`, `uploadApi`, `customerApi`, `salesInvoiceApi`), base URL from `VITE_API_URL` env var
- `hooks/useQueue.ts`, `hooks/useUpload.ts`, `hooks/useCustomers.ts`, `hooks/useSalesInvoices.ts` — React Query hooks
- `components/queue/` — `QueueList.tsx`, `QueueItem.tsx`, `QueueItemEdit.tsx`
- `components/upload/` — `UploadZone.tsx`, `UploadProgress.tsx`
- `components/invoices/` — `InvoiceList.tsx`, `InvoiceForm.tsx`, `InvoiceDetail.tsx`, `LineItemRow.tsx`
- `components/customers/` — `CustomerList.tsx`, `CustomerForm.tsx`
- `components/common/` — `StatusBadge.tsx`, `DarkModeToggle.tsx`, `Button.tsx`, `Modal.tsx`
- `components/layout/` — `Layout.tsx`, `Header.tsx` (with Queue / Invoices / Customers nav tabs)

Tailwind uses `primary-600` (orange brand color) as the accent. Dark mode is supported via `dark:` variants.

### Key Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_HOST/PORT/NAME/USER/PASSWORD` | — | PostgreSQL connection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `minicpm-v:8b` | Vision model for invoice parsing |
| `VITE_API_URL` | `/api` | Frontend API base URL |
| `PORT` | `3000` | Backend port |
| `UPLOAD_DIR` | `./uploads` | PDF storage directory |
| `SMTP_HOST` | `smtp.mail.me.com` | SMTP server (iCloud) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | App-specific password |
| `SMTP_FROM` | — | From address |
| `COMPANY_NAME` | `Wiz3D Prints` | Appears on PDF invoices |
| `COMPANY_EMAIL` | — | Appears on PDF invoices |
| `COMPANY_PHONE` | — | Appears on PDF invoices |
| `COMPANY_ADDRESS` | — | Appears on PDF invoices |

### Deployment

Docker Compose (`compose.yaml`) runs three containers: `wizqueue-backend` (port 3000), `wizqueue-frontend` (nginx on port 8080), and `wizqueue-ollama` (port 11434). The frontend container is built with `VITE_API_URL=/api` so nginx proxies API calls to the backend. Dockerfiles are in `infrastructure/docker/`.

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

# IMPORTANT: Always build shared before running tsc checks
cd packages/shared && npm run build

# Database migrations
npm run migrate        # Runs packages/backend/migrations/run-migrations.js
                       # Requires .env with DATABASE_* credentials

# Production (after build)
cd packages/backend && node dist/index.js

# Docker deployment
docker compose up -d
docker compose up -d --build   # Force rebuild after code changes
```

There are no test scripts defined. Backend uses `tsx watch` for development hot-reload.

---

## Architecture

**npm workspaces monorepo** — three packages:

| Package | Purpose |
|---|---|
| `packages/shared` | TypeScript types only, consumed by backend + frontend as `@wizqueue/shared` |
| `packages/backend` | Express + TypeScript API server (ESM modules, `"type": "module"`) |
| `packages/frontend` | React + Vite + TypeScript + Tailwind CSS SPA |

---

## Database

PostgreSQL. Migrations live in `packages/backend/migrations/` and are applied in filename order via `run-migrations.js`. Each migration is tracked in a `migrations` table so it runs only once.

| Migration | Table | Notes |
|---|---|---|
| `001_create_invoices_table.sql` | `invoices` | Incoming PDF upload tracking (Ollama OCR) |
| `002_create_queue_items_table.sql` | `queue_items` | Print queue |
| `003_create_customers_table.sql` | `customers` | Sales customers |
| `004_create_sales_invoices_table.sql` | `sales_invoices` | Sales invoices (`INV-XXXX` sequence) |
| `005_create_invoice_line_items_table.sql` | `invoice_line_items` | Line items; FK to queue_items when sent to queue |
| `006_create_products_table.sql` | `products` + alter `invoice_line_items` | Product catalog; adds `product_id` FK to line items |

---

## Backend (`packages/backend/src/`)

### Structure
```
index.ts              Express app setup + startup health checks (DB, Ollama)
config/
  database.ts         pg Pool
  ollama.ts           axios client for Ollama
middleware/
  error-handler.ts
models/
  queue-item.model.ts
  invoice.model.ts
  customer.model.ts
  product.model.ts
  sales-invoice.model.ts
  invoice-line-item.model.ts
services/
  queue.service.ts
  customer.service.ts
  product.service.ts
  sales-invoice.service.ts    orchestrates invoices + line items + queue push
  ollama.service.ts           LLM invoice extraction
  pdf.service.ts              PDF → base64 images
  pdf-generator.service.ts    pdfkit — generates styled sales invoice PDFs
  email.service.ts            nodemailer — iCloud SMTP
controllers/
  queue.controller.ts
  upload.controller.ts
  customer.controller.ts
  product.controller.ts
  sales-invoice.controller.ts
routes/
  queue.routes.ts
  upload.routes.ts
  customer.routes.ts
  product.routes.ts
  sales-invoice.routes.ts
migrations/
  run-migrations.js
  001–006 *.sql
```

### PDF upload flow (existing)
PDF upload → `pdf.service.ts` converts pages to base64 images → `ollama.service.ts` sends to Ollama vision model → extracted `ExtractedProduct[]` → saved as `queue_items`.

### Sales invoice flow (new)
Create invoice (with optional line items) → add/edit line items, picking from product catalog or entering manually → Download PDF (`pdf-generator.service.ts`) → Send email (`email.service.ts`) → Send to queue (`sales-invoice.service.ts`) → `queue_items` rows created, `units_sold` incremented on linked products.

### All API endpoints

**Queue**
- `GET /api/queue` — list all (ordered by position)
- `POST /api/queue` — create item
- `GET /api/queue/:id`
- `PUT /api/queue/:id`
- `DELETE /api/queue/:id`
- `POST /api/queue/batch` — batch create
- `PATCH /api/queue/reorder` — drag-drop reorder `{ itemId, newPosition }`
- `PATCH /api/queue/:id/status` — status update `{ status }`

**Upload (Ollama OCR)**
- `POST /api/upload` — PDF upload (multipart), triggers Ollama extraction
- `GET /api/upload/:id` — processing status

**Customers**
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

**Products**
- `GET /api/products` — `?active=true` to filter active only
- `POST /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

**Sales Invoices**
- `GET /api/sales-invoices`
- `POST /api/sales-invoices` — body: `{ customerId?, taxRate?, taxExempt?, notes?, dueDate?, lineItems[] }`
- `GET /api/sales-invoices/:id` — includes nested customer + line items
- `PUT /api/sales-invoices/:id`
- `DELETE /api/sales-invoices/:id` — draft only
- `POST /api/sales-invoices/:id/line-items`
- `PUT /api/sales-invoices/:id/line-items/:itemId`
- `DELETE /api/sales-invoices/:id/line-items/:itemId`
- `POST /api/sales-invoices/:id/send` — generates PDF + sends email, marks status=sent
- `POST /api/sales-invoices/:id/send-to-queue` — body: `{ lineItemIds?: number[] }` (omit for all); creates queue_items, increments product units_sold
- `GET /api/sales-invoices/:id/pdf` — streams PDF download

**Health**
- `GET /health` — `{ status, services: { database, ollama } }`

---

## Shared Types (`packages/shared/src/types/`)

| File | Exports |
|---|---|
| `queue-item.ts` | `QueueItem`, `QueueItemStatus`, `CreateQueueItemDto`, `UpdateQueueItemDto`, `ReorderQueueDto` |
| `invoice.ts` | `Invoice`, `ExtractedProduct`, `InvoiceUploadResponse`, `InvoiceProcessingStatus` |
| `customer.ts` | `Customer`, `CreateCustomerDto`, `UpdateCustomerDto` |
| `product.ts` | `Product`, `CreateProductDto`, `UpdateProductDto` |
| `sales-invoice.ts` | `SalesInvoice`, `SalesInvoiceStatus`, `InvoiceLineItem`, `CreateSalesInvoiceDto`, `UpdateSalesInvoiceDto`, `CreateLineItemDto` |
| `api.ts` | `ApiResponse`, `ApiError`, `PaginatedResponse` |

---

## Frontend (`packages/frontend/src/`)

### Routing (react-router-dom)
| Path | Component | Notes |
|---|---|---|
| `/` | `QueueView` (inline in App.tsx) | Queue with All/Pending/Printing filter tabs |
| `/customers` | `CustomerList` | |
| `/customers/new` | `CustomerForm` | |
| `/customers/:id` | `CustomerForm` | Edit mode |
| `/products` | `ProductList` | Shows units_sold, active toggle |
| `/products/new` | `ProductForm` | |
| `/products/:id` | `ProductForm` | Edit mode |
| `/invoices` | `InvoiceList` | |
| `/invoices/new` | `InvoiceForm` | |
| `/invoices/:id` | `InvoiceDetail` | |

### Navigation order
**Customers → Products → Invoices → Queue**

### Key files
```
App.tsx               BrowserRouter + all route definitions
main.tsx              Forces dark class on <html>; QueryClient setup
styles/globals.css    All base styles, .btn-primary, .btn-secondary, .card, .input, .wiz-table etc.
tailwind.config.js    Extended with iron/primary color palette
services/api.ts       queueApi, uploadApi, customerApi, productApi, salesInvoiceApi
hooks/
  useQueue.ts
  useUpload.ts
  useCustomers.ts
  useProducts.ts
  useSalesInvoices.ts   also exports useSalesInvoice(id) for detail view
components/
  layout/
    Layout.tsx          iron-950 background, sticky header, footer
    Header.tsx          Frosted-glass sticky nav, orange gradient active tab
  common/
    StatusBadge.tsx     draft/sent/paid/cancelled colored badges
    DarkModeToggle.tsx  (kept but not rendered — site is always dark)
    Button.tsx
    Modal.tsx
  queue/
    QueueList.tsx
    QueueItem.tsx
    QueueItemEdit.tsx
  upload/
    UploadZone.tsx
    UploadProgress.tsx
  customers/
    CustomerList.tsx
    CustomerForm.tsx
  products/
    ProductList.tsx     units_sold column, active/inactive toggle
    ProductForm.tsx
  invoices/
    InvoiceList.tsx
    InvoiceForm.tsx     Product picker dropdown auto-fills name/price/description
    InvoiceDetail.tsx   Inline add item (with product picker), send to queue per-item or all
    LineItemRow.tsx     Inline edit, → Queue button per row
```

### Branding
Matches wiz3dprints.com exactly:
- **Always dark** — `dark` class forced on `<html>` in `main.tsx`
- **Background**: `#0a0a0a` (iron-950)
- **Cards**: gradient `#3a3a3a → #2d2d2d`
- **Primary buttons**: gradient `#ff9900 → #e68a00`, border-radius 0.75rem, depth shadows + hover lift
- **Secondary buttons**: gradient `#4a4a4a → #3a3a3a`
- **Inputs**: dark sunken, orange focus ring (`#e68a00`)
- **Text**: `#e5e5e5` primary, `#d1d5db` secondary
- **Orange accent**: `#ff9900` / `#e68a00` (primary-400/500/600 all point to these)
- **Font**: Poppins (Google Fonts, loaded in `index.html`)
- CSS classes: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.input`, `.card`, `.card-surface`, `.wiz-table`, `.nav-tab-active`, `.nav-tab-inactive`

### Totals calculation (client-side only — no extra DB field)
```
subtotal  = sum(lineItem.quantity * lineItem.unitPrice)
taxAmount = invoice.taxExempt ? 0 : subtotal * invoice.taxRate
total     = subtotal + taxAmount
```
Default tax rate: **7%**

---

## Key Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_HOST/PORT/NAME/USER/PASSWORD` | — | PostgreSQL connection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `minicpm-v:8b` | Vision model for invoice parsing |
| `VITE_API_URL` | `/api` | Frontend API base URL |
| `PORT` | `3000` | Backend port |
| `UPLOAD_DIR` | `./uploads` | PDF storage directory |
| `SMTP_HOST` | `smtp.mail.me.com` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | App-specific password |
| `SMTP_FROM` | — | From address |
| `COMPANY_NAME` | `Wiz3D Prints` | Appears on PDF invoices |
| `COMPANY_EMAIL` | — | Appears on PDF invoices |
| `COMPANY_PHONE` | — | Appears on PDF invoices |
| `COMPANY_ADDRESS` | — | Appears on PDF invoices |

---

## Deployment

Docker Compose (`compose.yaml`) — three containers:
- `wizqueue-backend` → port 3000
- `wizqueue-frontend` → nginx on port 8080 (`VITE_API_URL=/api`, proxied to backend)
- `wizqueue-ollama` → port 11434

Dockerfiles: `infrastructure/docker/`

**Deploy new changes:**
```bash
git pull origin master
npm run migrate          # apply new SQL migrations
docker compose up -d --build
```

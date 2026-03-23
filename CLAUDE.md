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
                       # Requires .env with DATABASE_* or DATABASE_URL credentials

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
| `007_add_shipping_and_sku.sql` | `sales_invoices`, `products` | Adds `shipping_cost` to invoices; `sku` to products |
| `008_add_sku_to_line_items_and_queue.sql` | `invoice_line_items`, `queue_items` | Adds `sku` column to both tables |
| `009_backfill_product_ids.sql` | `invoice_line_items` | Backfills `product_id` by matching name + price |
| `010_add_missing_products.sql` | `products`, `invoice_line_items` | Adds 3 missing products; name-only backfill for remaining unlinked items |
| `011_create_users_table.sql` | `users` | Auth users (id, username, email, password_hash, role, timestamps) |
| `012_create_colors_table.sql` | `colors` | Print color catalog (name, hex, active, sort_order); seeded with 30 Bambu Lab PLA colors |
| `013_create_line_item_colors_table.sql` | `line_item_colors` | Colors assigned to invoice line items (colorId, isPrimary, note, sortOrder) |
| `014_create_queue_item_colors_table.sql` | `queue_item_colors` | Colors assigned to queue items; auto-copied from line item on send-to-queue |
| `015_reseed_bambu_colors.sql` | `colors` | TRUNCATE + re-insert correct Bambu Lab PLA colors (run if seeded with wrong colors) |

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
  auth.middleware.ts  requireAuth, requireAdmin, optionalAuth
models/
  queue-item.model.ts
  invoice.model.ts
  customer.model.ts
  product.model.ts
  sales-invoice.model.ts
  invoice-line-item.model.ts
  user.model.ts
services/
  queue.service.ts
  customer.service.ts
  product.service.ts
  sales-invoice.service.ts    orchestrates invoices + line items + queue push
  ollama.service.ts           LLM invoice extraction
  pdf.service.ts              PDF → base64 images
  pdf-generator.service.ts    pdfkit — generates styled sales invoice PDFs
  email.service.ts            nodemailer — iCloud SMTP
  auth.service.ts             bcrypt + JWT sign/verify/register/login
controllers/
  queue.controller.ts
  upload.controller.ts
  customer.controller.ts
  product.controller.ts
  sales-invoice.controller.ts
  auth.controller.ts
  users.controller.ts
routes/
  queue.routes.ts
  upload.routes.ts
  customer.routes.ts
  product.routes.ts
  sales-invoice.routes.ts
  auth.routes.ts              public: /login, /register (optionalAuth), /me
  users.routes.ts             admin-only: list/create/update/reset-password/delete
migrations/
  run-migrations.js
  001–011 *.sql
```

### PDF upload flow
PDF upload → `pdf.service.ts` converts pages to base64 images → `ollama.service.ts` sends to Ollama vision model → extracted `ExtractedProduct[]` → saved as `queue_items`.

### Sales invoice flow
Create invoice (with optional line items) → add/edit line items, picking from product catalog or entering manually → Download PDF (`pdf-generator.service.ts`) → Send email (`email.service.ts`) → Send to queue (`sales-invoice.service.ts`) → `queue_items` rows created, `units_sold` incremented on linked products.

### All API endpoints

**Auth** (public — no token required except `/me`)
- `POST /api/auth/login` — `{ username, password }` → `{ user, token }`
- `POST /api/auth/register` — optionalAuth; first user gets admin, subsequent require admin token
- `GET /api/auth/me` — requireAuth; returns current user

**Queue**
- `GET /api/queue` — list all (ordered by position)
- `POST /api/queue` — create item
- `GET /api/queue/:id`
- `PUT /api/queue/:id`
- `DELETE /api/queue/:id`
- `POST /api/queue/batch` — batch create
- `PATCH /api/queue/reorder` — drag-drop reorder `{ itemId, newPosition }`
- `PATCH /api/queue/:id/status` — status update `{ status }`
- `PUT /api/queue/:id/colors` — set colors `{ colors: [{ colorId, isPrimary, note, sortOrder }] }`

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
- `GET /api/products/suggest-sku?name=...&excludeId=...` — returns suggested SKU string
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
- `PUT /api/sales-invoices/:id/line-items/:itemId/colors` — set colors; also syncs to linked queue item if already queued
- `POST /api/sales-invoices/:id/send` — generates PDF + sends email, marks status=sent
- `POST /api/sales-invoices/:id/send-to-queue` — body: `{ lineItemIds?: number[] }` (omit for all); creates queue_items, increments product units_sold
- `GET /api/sales-invoices/:id/pdf` — streams PDF download

**Colors**
- `GET /api/colors` — list all colors (authenticated)
- `POST /api/colors` — create (admin only)
- `PUT /api/colors/:id` — update (admin only)
- `DELETE /api/colors/:id` — delete (admin only)

**Users** (admin only)
- `GET /api/users` — list all users
- `POST /api/users` — create user (reuses auth.service.register)
- `PUT /api/users/:id` — update email/role (cannot change own role)
- `POST /api/users/:id/reset-password` — hash + update password
- `DELETE /api/users/:id` — delete user (cannot delete own account)

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
| `auth.ts` | `User`, `LoginDto`, `RegisterDto`, `AuthResponse` |
| `api.ts` | `ApiResponse`, `ApiError`, `PaginatedResponse` |
| `color.ts` | `Color`, `ItemColor`, `ItemColorDto`, `CreateColorDto`, `UpdateColorDto` |

---

## Frontend (`packages/frontend/src/`)

### Routing (react-router-dom)
| Path | Component | Notes |
|---|---|---|
| `/` | `Dashboard` | Revenue stats, queue summary, customer/product counts |
| `/queue` | `QueueView` (inline in App.tsx) | Queue with counter boxes as filter tabs (Printing/Pending/Completed/In Queue) |
| `/customers` | `CustomerList` | |
| `/customers/new` | `CustomerForm` | |
| `/customers/:id` | `CustomerForm` | Edit mode |
| `/products` | `ProductList` | Shows units_sold, active toggle |
| `/products/new` | `ProductForm` | |
| `/products/:id` | `ProductForm` | Edit mode |
| `/invoices` | `InvoiceList` | |
| `/invoices/new` | `InvoiceForm` | |
| `/invoices/:id` | `InvoiceDetail` | |
| `/admin/users` | `UsersPage` | Admin only — list/create/edit/delete users |
| `/admin/colors` | `ColorsPage` | Admin only — manage print color catalog |
| `/admin/printers` | `PrintersPage` | Admin only — manage printer list for queue assignment |
| `/admin/manufacturers` | `ManufacturersPage` | Admin only — manage filament manufacturers |
| `/filament` | `FilamentPage` | Filament inventory overview |
| `/login` | `LoginPage` | No Layout wrapper, full-page form |

### Navigation — left side nav (SideNav.tsx)
The app uses a **collapsible left sidebar** (`SideNav.tsx`), NOT a top header. `Header.tsx` has been deleted.

**Layout**: `Layout.tsx` renders `<SideNav>` on the left + main content area. Mobile shows a hamburger button that slides the sidebar in.

**Sidebar sections** (each collapsible):
- *(top)* Dashboard
- **Operations**: Queue, Customers, Products, Invoices
- **Filament**: Inventory, Manufacturers (admin only)
- **Admin** *(admin role only)*: Users, Colors, Printers

To add a new nav item, edit `SideNav.tsx` — add a `<NavItem>` inside the appropriate section.

### Key files
```
App.tsx               BrowserRouter + all route definitions
main.tsx              Forces dark class on <html>; QueryClient setup
context/
  AuthContext.tsx      login(), logout(), isAuthenticated, user — wraps whole app
components/auth/
  LoginPage.tsx        Full-page login form
  ProtectedRoute.tsx   Redirects unauthenticated to /login
styles/globals.css    All base styles, .btn-primary, .btn-secondary, .card, .input, .wiz-table etc.
tailwind.config.js    Extended with iron/primary color palette
services/api.ts       queueApi, uploadApi, customerApi, productApi, salesInvoiceApi, userApi, colorApi
hooks/
  useQueue.ts
  useUpload.ts
  useCustomers.ts
  useProducts.ts
  useSalesInvoices.ts   also exports useSalesInvoice(id) for detail view; updateLineItemColors syncs to queue
  useUsers.ts           admin user management
  useColors.ts          color catalog; create/update/delete (admin)
components/
  layout/
    Layout.tsx          Sidebar + main content wrapper; idle timeout modal
    SideNav.tsx         Collapsible left sidebar — THE nav. Add items here, NOT Header.tsx (deleted)
  common/
    StatusBadge.tsx     draft/sent/paid/cancelled colored badges
    Button.tsx
    Modal.tsx
    ColorPicker.tsx     swatch palette; select up to 4 colors (1 primary + 3); note per color
    ColorSwatch.tsx     exported from ColorPicker.tsx — small colored circle
  dashboard/
    Dashboard.tsx       Stat cards: queue, invoices (revenue), customers, products
  queue/
    QueueList.tsx       Filter: 'all' shows pending+printing (printing sorted first); 'completed' shows history
    QueueItem.tsx       Completing an item sets status='completed' (keeps row in DB); shows color swatches
    QueueItemEdit.tsx   Includes ColorPicker; colors saved via colorApi.setQueueItemColors after update
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
    InvoiceForm.tsx     Product picker; "+ Colors" button per line item expands inline picker
    InvoiceDetail.tsx   Inline add item with "+ Colors" button (under product name, orange); color sync on save
    LineItemRow.tsx     Inline edit with ColorPicker expansion row; shows color swatches in read mode
  admin/
    UsersPage.tsx       List users, add user, inline email edit, role dropdown, reset password, delete
    ColorsPage.tsx      Add/edit/delete Bambu Lab PLA colors; toggle active; live swatch preview
    PrintersPage.tsx    Add/edit/delete printers (name + model); active toggle; used in queue assignment
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
total     = subtotal + shippingCost + taxAmount
```
Default tax rate: **7%** (Iowa sales tax). Shipping is not taxed.

---

## Key Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_HOST/PORT/NAME/USER/PASSWORD` | — | PostgreSQL connection (individual vars) |
| `DATABASE_URL` | — | PostgreSQL connection string (alternative to individual vars) |
| `JWT_SECRET` | — | **Required** — secret for signing JWT tokens |
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
- `wizqueue-ollama` → port 11434 (or Ollama runs natively on host — accessed via `host.docker.internal`)

Dockerfiles: `infrastructure/docker/`

### First-time setup

1. Copy `.env.example` to `.env` and fill in all values, including `JWT_SECRET`
2. Run migrations: `npm run migrate`
3. Start containers: `docker compose up -d --build`
4. Register the first admin user (gets admin role automatically):
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"yourpassword"}'
   ```
5. Subsequent users can be created from the Admin → Users page in the UI

### Deploy new changes

```bash
git pull origin master
npm run migrate          # apply any new SQL migrations
docker compose up -d --build
```

# Wiz3D Tools — 3D Printing Business Suite

Self-hosted web application for managing a 3D printing business: print queue, sales invoices, customers, products, filament inventory, and more.

## Features

- **Print Queue** — drag-and-drop queue with status tracking (Pending / Printing / Completed); bulk status actions; color swatch display
- **Sales Invoices** — full invoice lifecycle (Draft → Sent → Paid → Shipped); PDF generation; email delivery; line items with product picker; tax-exempt support; carrier + tracking numbers
- **Customers** — full CRUD with invoice history per customer
- **Products** — catalog with SKU, pricing, units sold, revenue tracking; per-color filament weight from slicer data
- **Filament Inventory** — track inventory by color and manufacturer; spool weight management; low/critical stock alerts; auto-deduct on queue completion
- **Manufacturers** — manage spool weights and low/critical thresholds per manufacturer
- **Color Catalog** — admin-managed print color list (pre-seeded with Bambu Lab PLA colors); colors assigned to line items and queue items
- **PDF Invoice Upload** — Ollama vision LLM extracts products from supplier PDF invoices → auto-populates queue
- **Dashboard** — revenue stats, queue summary, filament inventory overview, recent invoices
- **Auth** — JWT (HttpOnly cookie), CSRF protection, role-based access (admin / user), idle session timeout
- **Admin** — user management, color catalog, manufacturer management, audit logging

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript (ESM)
- **Database**: PostgreSQL (22 migrations)
- **AI**: Ollama (`minicpm-v:8b` vision model)
- **Deployment**: Docker + Docker Compose + Nginx

## Project Structure

```
wiz3dtools/
├── packages/
│   ├── backend/       # Express API server
│   ├── frontend/      # React SPA
│   └── shared/        # Shared TypeScript types
└── infrastructure/    # Docker and deployment configs
```

## Quick Start

### Prerequisites

- Node.js >= 20.19.0
- PostgreSQL >= 14
- Ollama with `minicpm-v:8b` model

### Local Development

```bash
git clone <repository-url>
cd wiz3dtools
npm install
cp .env.example .env        # fill in DATABASE_*, JWT_SECRET, SMTP_*, COMPANY_*
npm run migrate
npm run dev
```

Frontend: http://localhost:5173 · Backend: http://localhost:3000

### Docker (Production)

```bash
cp .env.example .env        # fill in all values
npm run migrate
docker compose up -d --build
```

Register the first admin user (gets admin role automatically):

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"admin","password":"yourpassword"}'
```

### Deploy Updates

```bash
git pull origin master
npm run migrate
docker compose up -d --build
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture reference and AI assistant instructions
- [`CHANGES.md`](CHANGES.md) — full session-by-session change log
- [`SECURITY.md`](SECURITY.md) — security audit and controls
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — production deployment guide
- [`GETTING_STARTED.md`](GETTING_STARTED.md) — detailed local development guide

## License

MIT

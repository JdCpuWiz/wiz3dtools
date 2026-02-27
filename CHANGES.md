# CHANGES.md

Running log of completed work and what's still planned.

---

## Completed

### Session 1 — Initial queue app
- Queue management UI (drag-drop reorder, status update)
- PDF invoice upload → Ollama OCR → auto-populate queue
- Tabbed filter: All / Pending / Printing
- Wiz3D Prints logo in header
- Dark mode toggle

### Session 2 — Invoicing module
- **Customers** — full CRUD (`/customers`)
- **Sales Invoices** — full CRUD with line items (`/invoices`)
  - Invoice numbers auto-sequence: INV-0001, INV-0002, …
  - Tax rate + tax-exempt flag
  - Notes, due date
- **PDF generation** — branded invoice PDF via pdfkit (orange theme, company info)
- **Email delivery** — nodemailer + iCloud SMTP (`SMTP_*` env vars)
- **Send to Queue** — push individual or all line items to the print queue
- React Router navigation
- Header nav tabs: Queue / Invoices / Customers

### Session 3 — Products module + branding overhaul
- **Products** — full CRUD (`/products`)
  - name, description, unit price, active/inactive
  - **Units Sold** — auto-increments each time a line item linked to the product is sent to queue
- **Product picker** in invoice line-item editor — selecting a product auto-fills name, price, description
- **Branding** — fully matches wiz3dprints.com:
  - Always-dark iron black theme (`#0a0a0a`), no light mode
  - Orange gradient buttons (`#ff9900 → #e68a00`) with depth shadows + hover lift
  - Steel-grey card surfaces, dark sunken inputs, orange focus rings
  - Poppins font, sticky frosted-glass header
  - Removed dark mode toggle
- **Nav order** changed to: Customers → Products → Invoices → Queue
- **Default tax rate** changed to 7%

### Session 4 — Shipping, SKU codes, IA tax label, UX improvements
- **Migration 007** — adds `shipping_cost` to `sales_invoices`, `sku` to `products` (unique partial index)
- **Product SKU field** — auto-generated from product name initials (e.g. "Phone Stand" → `PS-001`), editable; stored in DB; `GET /api/products/suggest-sku?name=...` endpoint
- **Shipping cost** — non-taxable, tracked per invoice; editable inline in InvoiceDetail; passed to PDF
- **Tax label** — "GST" → "IA Sales Tax" everywhere (UI + PDF); company is Iowa, USA
- **Totals formula** — `subtotal + shippingCost + taxAmount` (tax on subtotal only, shipping excluded from tax base)
- **InvoiceForm** — full totals panel (Subtotal / Shipping input / IA Sales Tax / Total); details column uses `<textarea rows={3}>`
- **InvoiceDetail** — inline ShippingEdit (click to edit), wider totals panel (`w-64`), correct formula
- **LineItemRow** — details field in edit mode is now a `<textarea rows={3}>`
- **ProductForm** — SKU field with 400ms debounced auto-suggest; description textarea increased to `rows={6}`
- **Global `/savesession` skill** — created at `~/.claude/skills/savesession/SKILL.md`; updates docs + commits + pushes on demand

### Session 5 — Branding polish, PDF overhaul, Docker env fix
- **App renamed** to "Wiz3d Tools" / "3D Printing Business Suite" (index.html, Header, Layout footer)
- **Favicon** — PNG favicon already in place; added `<link rel="apple-touch-icon">` for mobile
- **Queue item cards** — full iron/orange dark theme: status colours, qty badge (orange text on iron), Edit/Delete buttons use `.btn-secondary`/`.btn-danger`, footer divider iron-coloured
- **PDF invoice overhaul:**
  - All section boxes (company info, Bill To, Totals, Notes) → soft light grey `#f0f0f0` rounded rects
  - Company info block (logo + name + email/phone/address) wrapped in matching box top-left
  - Bill To: country removed from address line
  - Date format: "Month DD, YYYY" (e.g. February 26, 2026)
  - Date labels right-aligned so colons line up; date values left-aligned beside them
- **Docker fix** — `compose.yaml` was missing `COMPANY_*` and `SMTP_*` env var forwards; company details were silently blank in all Docker deployments

---

## Outstanding / Planned

### Queue improvements
- [ ] **Include product SKU on invoicing screen** — show SKU on invoice line items, queue cards, and printed PDF
- [ ] **Add single item to queue manually** — button/form to add one item without an invoice
- [ ] **Partial complete** — for items with qty > 1, mark a portion as done (e.g. 3 of 5 printed)
- [ ] **Manually edit queue item qty** — change the quantity on an existing queue item
- [ ] **Upload screen back navigation** — a way to return to queue without closing the upload modal
- [ ] **Ability to change the tax exemption status on an invoice** — toggleable on existing invoices

### Invoice / PDF improvements
- [ ] **Add payment links to printed invoice** — include on PDF:
      COMPANY_WEBSITE=https://showcase.wiz3dprints.com
      COMPANY_PAYPAL=https://su.wiz3dprints.com/print-sorcerer
      COMPANY_VENMO=https://su.wiz3dprints.com/forge-magic
  (vars already in `.env.example`; need to forward in `compose.yaml` and render in PDF)

### Future ideas
- [ ] Dashboard / summary page (items in queue, invoices outstanding, revenue this month)
- [ ] Invoice status filter on invoice list (All / Draft / Sent / Paid)
- [ ] Customer invoice history view
- [ ] Product sales report / export
- [ ] Bulk status update on queue items

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

---

## Outstanding / Planned

### Queue improvements (from original brief)
- [ ] **Add single item to queue manually** — button/form to add one item without an invoice
- [ ] **Partial complete** — for items with qty > 1, mark a portion as done (e.g. 3 of 5 printed)
- [ ] **Manually edit queue item qty** — change the quantity on an existing queue item
- [ ] **Upload screen back navigation** — a way to return to queue without closing the upload modal (may be superseded by the invoicing flow)

### Branding / polish
- [ ] **Favicon** — proper favicon (not just logo PNG) for browser tab
- [ ] **Queue items styling** — ensure queue cards/items fully match wiz3d dark theme

### Future ideas
- [ ] Dashboard / summary page (items in queue, invoices outstanding, revenue this month)
- [ ] Invoice status filter on invoice list (All / Draft / Sent / Paid)
- [ ] Customer invoice history view
- [ ] Product sales report / export
- [ ] Bulk status update on queue items

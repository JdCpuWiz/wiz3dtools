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

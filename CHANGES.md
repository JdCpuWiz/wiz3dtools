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

### Session 6 — PDF download auth fix + page overflow fix
- **PDF download auth** — changed `<a href>` link to `fetch()` with `Authorization: Bearer` header + blob download; plain links can't send JWT tokens
- **PDF page overflow** — invoices with many line items were producing ~15 mostly-blank pages (one element per page); added page break detection in line items loop, re-draws table header on continuation pages, added overflow check before totals section

### Session 10 — Print colors feature
- **Color catalog** — admin-managed list of print colors (name + hex); pre-seeded with all 30 Bambu Lab PLA colors; migrations 012–015
- **Admin → Colors page** (`/admin/colors`) — add/edit/delete colors, toggle active/inactive, live swatch preview; header now shows "Users" + "Colors" tabs for admins
- **ColorPicker component** — swatch palette, click to add up to 4 colors (1 primary + 3 more); each color has a short note field; primary highlighted in orange
- **Invoice line items** — colors shown as swatches below product name in read mode; color picker expands inline in edit mode; "+ Colors" button (orange, under product name) in Add Item row
- **Queue items** — color swatches displayed on each queue card; primary color in orange, others in grey
- **QueueItemEdit modal** — color picker included; colors saved on submit
- **AddItemForm** (manual queue add) — color picker included
- **InvoiceForm** (new invoice) — "+ Colors" button per line item expands inline picker
- **Color sync** — colors copied from line item → queue item when sent to queue; if line item colors are updated after queuing, queue item colors are synced automatically
- **Bambu Lab reseed** — `bambu-colors.md` in project root; migration 015 truncates + reseeds with correct colors

### Session 9 — Paid invoice edit warning
- **Paid invoice guard** — all edit actions on a paid invoice now prompt for confirmation before proceeding: change customer, change status, tax exempt toggle, shipping edit, add line item, edit/delete line items
- `confirmIfPaid()` helper in `InvoiceDetail.tsx` — returns `true` immediately for non-paid invoices, shows `window.confirm` for paid ones

### Session 8 — Queue counter quantity fix + edit modal bug fixes
- **Counter sums quantity** — Printing/Pending/Completed/In Queue counters now sum `item.quantity` instead of counting rows; items with qty > 1 were being undercounted
- **Edit modal pre-fill fixed** — clicking Edit on a queue item now correctly pre-fills all fields (product name, qty, priority, details, notes)
  - Root cause: `Input` component (`components/common/Input.tsx`) was not using `React.forwardRef`, so react-hook-form's `register()` ref never reached the DOM input; `reset()` worked on textareas (direct elements) but silently failed on `Input` wrappers
  - Fix: `Input` now uses `React.forwardRef`; edit form uses `reset()` in `useEffect([item.id])`; `QueueItemEdit` conditionally rendered so it remounts fresh on each open

### Session 7 — Queue status counters, completed tracking, filter UX overhaul
- **Status counter card** — Printing / Pending / Completed / In Queue counts displayed in a shaded card at top of queue screen; numbers in status colours (amber/blue/green/white)
- **Counter boxes as filter tabs** — clicking any counter box filters the queue list to that status; active box shows orange underline + highlight; replaces the old All/Pending/Printing tab strip
- **Completed items tracked in DB** — marking an item complete now sets `status='completed'` instead of deleting the row; fixes qty=1 complete doing nothing and partial complete deleting the row
- **Completed filter** — new "Completed" view shows all historically completed items
- **All view sorting** — printing items bubble to the top of the active queue; rest in position order
- **Header cleanup** — removed redundant "Print Queue (N items)" heading; drag-and-drop hint moved inline; counters left → Add Item → hint

---

## Outstanding / Planned

### Queue improvements
- [ ] **Include product SKU on invoicing screen** — show SKU on invoice line items, queue cards, and printed PDF
- [ ] **Upload screen back navigation** — a way to return to queue without closing the upload modal

### Future ideas
- [ ] Dashboard / summary page (items in queue, invoices outstanding, revenue this month)
- [ ] Customer invoice history view
- [ ] Product sales report / export
- [ ] Bulk status update on queue items

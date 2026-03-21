# CHANGES.md

Running log of completed work and what's still planned.

---

## Completed

### Session 20 — UI styling overhaul (v1.3.16–1.3.28)

**Solid status badges (global standard)**
- All status indicators, value pills, toggle buttons, and filter tabs now use solid opaque backgrounds with high-contrast text — no more semi-transparent or dark-tinted backgrounds
- Invoice statuses: Draft `#6b7280`, Sent `#1d4ed8`, Paid `#15803d`, Shipped `#6d28d9`, Cancelled `#b91c1c` — all white text
- Active/Inactive product and color toggles: `#15803d` / `#6b7280`
- FilamentPage: OK `#15803d`, Low `#eab308` (black text), Critical `#b91c1c`, Empty `#4b5563`, Disabled `#6b7280`
- ManufacturersPage: Low threshold `#eab308`, Critical threshold `#b91c1c`
- LineItemRow "In queue" badge and "→ Queue" button: `#15803d`
- InvoiceDetail Shipped header badge: `#6d28d9`; Set/Remove exempt button: `#d97706`
- Side nav active item: solid `#ff9900` with white text (was semi-transparent)
- Standard codified in global `~/.claude/CLAUDE.md` for all future projects

**Alternating row shading**
- `wiz-table` CSS class gets nth-child odd/even rules (`#181818` / `#232323`), covering Products, Invoices, Customers tables automatically
- ManufacturersPage, FilamentPage, ColorsPage: index-based alternating rows matching same palette

**FilamentPage filter pills**
- Inactive: neutral dark gray `#2d2d2d`; Active: yellow (`#eab308`) for Low, red (`#b91c1c`) for Critical
- Low filter now shows only Low stock items (previously also included Critical)

**ColorsPage**
- Inventory column: right-aligned grams value + `+ Spool` button; white text for manufacturer and weight
- `+ Spool` button: solid `#ff9900` with black text

### Session 19 — Filament tracking deep dive (v1.2.1–1.3.15)

- **InvoiceList weight column** — `hidden lg` column showing shipment weight in oz from line item color weights
- **InvoiceForm weight preview** — Est. Weight row in totals panel derived from `product.totalWeightGrams` on product select
- **Gross/net spool inventory** — `+ Spool` defaults to gross (filament + spool); all displays show net filament (gross − empty spool weight)
- **FilamentPage enable/disable** — per-row toggle for admin; disabled rows dimmed at 45% opacity; excluded from low/critical alerts
- **Add New Color form** on FilamentPage — name, hex, manufacturer, initial inventory; duplicate guard on name + manufacturer
- **ManufacturersPage color inline edit** — expandable color list per manufacturer row; hex picker + name edit inline
- **Color sort by manufacturer** — backend `ORDER BY m.name ASC NULLS LAST, c.name ASC`
- **ColorPicker grouped palette** — colors grouped under manufacturer headers
- **Swatch border fix** — all swatches use `border: 2px solid ${hex}` (matches swatch, invisible border)
- **ProductForm custom color dropdown** — replaced native `<select>` with custom `ColorDropdown`; grouped by manufacturer, swatch per option
- **Auto-populate line item colors from product** — selecting a product in InvoiceForm / InvoiceDetail / LineItemRow edit auto-fills colors from `product.colors`

### Session 18 — Filament tracking v1 (v1.2.0)

- **Manufacturers table** (migration 019) — `empty_spool_weight_g`, `full_spool_net_weight_g`, `low_threshold_g`, `critical_threshold_g`; Bambu Lab seeded (242g empty, 1007g net, 500g low, 200g critical)
- **Colors gain manufacturer + inventory** (migration 020) — `manufacturer_id` FK, `inventory_grams DECIMAL(10,2)`
- **Product colors table** (migration 021) — per-color weight from slicer data per product
- **Line/queue item color weights** (migration 022) — `weight_grams` on `line_item_colors` + `queue_item_colors`
- **FilamentPage** (`/filament`) — inventory table with progress bars, status badges, + Spool action, All/Low/Critical filter tabs
- **ManufacturersPage** (`/admin/manufacturers`) — CRUD for manufacturers with spool weights and thresholds
- **Side nav** — replaced top header nav with collapsible left sidebar (Operations / Filament / Admin sections)
- **Dashboard filament card** — replaced Customers card; shows total kg, low/critical alerts, top colors by inventory
- **Inventory deduction** — completing a queue item deducts `weight_grams` from `inventory_grams` on linked colors
- **Est. Weight on invoice PDF** — shown in totals section alongside shipping cost

### Session 17 — Security hardening (v1.1.1–v1.1.2)

- **M1 — Zod input validation** on all 8 controllers (queue, upload, customer, product, sales-invoice, auth, users, color)
- **H7 — HttpOnly cookies** — JWT moved from `Authorization` header / localStorage to HttpOnly cookie `wiz3d_token` (`SameSite=Strict`, `Secure` in prod); `POST /api/auth/logout` clears it server-side
- **M2 — CSRF protection** — 48-char hex `csrfToken` claim in JWT; validated as `X-CSRF-Token` header on all mutating requests; frontend stores in React state only

### Session 16 — Versioning, security audit, idle timeout (v1.1.0)

- **Versioning** — version injected at build time via `vite.config.ts` `define`; displayed in side nav footer and returned by `/health` + `/` endpoints
- **Full security audit** — `SECURITY.md` created; all C1-C3, H1-H9, M1-M9, L1-L3 items identified and tracked
- **Idle session timeout** — 30min inactivity → 60s countdown modal → auto-logout; implemented in `AuthContext.tsx` + `Layout.tsx`
- **M3 — Audit logging** (migration 018) — `audit_logs` table; logs actor/action/resource/timestamp for user management and invoice sensitive ops
- **multer patch** — added `limits: { fileSize: 20MB }` to prevent unbounded upload

### Session 15 — Shipped status, carrier/tracking, product data cleanup, units_sold accuracy

**Shipped status display**
- Invoice list and detail now show a teal **Shipped** badge (driven by `shippedAt`, not the status field)
- Invoice list has a new **Shipped** filter tab; draft/sent/paid counts exclude shipped invoices
- Dashboard invoices card shows Shipped pill; outstanding balance excludes shipped invoices
- Customer invoice history shows Shipped badge correctly
- Recent invoices table on dashboard shows Shipped badge

**Carrier + tracking URL (migration 017)**
- `carrier` column added to `sales_invoices`
- Carrier dropdown in InvoiceDetail (UPS / USPS / FedEx / DHL / Customer Pickup / Other)
- Tracking number renders as a clickable link to the carrier's tracking page for known carriers
- `Customer Pickup` option: no tracking number required; auto-saves on select; button shows "Ready for Pickup"; sends pickup-ready email if customer has email, skips silently if not

**units_sold accuracy**
- Removed `incrementSold` call from `sendToQueue` — shipping is now the authoritative event
- `ProductModel.recalcSoldFromShippedInvoices()` — full recalc from all shipped invoice line items on ship
- Backfilled `units_sold` for all products from historical invoice data via direct DB queries

**Product data cleanup (via DB)**
- Merged old Phone Stand variants (ids 1, 2, 13, 23, 24) → Phone Stand - Basic (id 26); 50 line items reassigned
- Deleted Credit on account product (id 25); its line item's product_id nulled
- `units_sold` backfilled for all 17 products with invoice history
- Line items on 4 unshipped paid invoices reassigned from Basic → Tooled Leather or Highland Cow by keyword match on details
- INV-0001, INV-0016: carrier set to USPS so tracking links render

**Other fixes**
- Date format on InvoiceDetail changed from `en-NZ` (DD/MM/YYYY) to `en-US` (MM/DD/YYYY)
- Product picker dropdown added to line item edit mode — selecting a product auto-fills name, SKU, unit price
- INV-0016 status updated to paid via DB

### Session 14 — Queue cleanup on ship
- When a sales invoice is marked as shipped, all queue items linked to that invoice's line items are now deleted (any status: pending, printing, or completed)
- Deletion is scoped strictly via `invoice_line_items.queue_item_id` FK — queue items from other invoices sharing the same product are unaffected
- `queue_item_colors` cascade-deletes automatically; `invoice_line_items.queue_item_id` nulls automatically via existing FK constraints
- Change in `SalesInvoiceService.ship()` (`packages/backend/src/services/sales-invoice.service.ts`)

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

### Session 11 — Invoice list sorting + shipping workflow
- **Sortable columns** — Invoice list columns (Invoice #, Customer, Date, Total) are now clickable sort headers; orange ▲/▼ indicator on active column; default sort is Date descending; ⇅ shown on inactive columns
- **Invoice shipping** — migration 016 adds `tracking_number` + `shipped_at` to `sales_invoices`
- **Tracking number field** — inline add/edit in the Status card on InvoiceDetail; saved via existing PUT endpoint
- **Mark as Shipped button** — blue button in header; requires tracking number + customer email; prompts confirmation; sets `shipped_at` and sends shipping notification email
- **Shipping email** — sent to customer with tracking number; CC to `orders@wiz3dprints.com`; uses `sendShippingEmail()` in `email.service.ts`
- **Shipped lock** — once `shippedAt` is set, all invoice editing is blocked (customer, status, tax, shipping cost, line items); `confirmIfPaid()` now checks shipped first; shipped invoices show a green "✓ Shipped [date]" badge

### Session 13 — Dashboard, customer history, product revenue, bulk queue actions
- **Dashboard — This Month revenue** — Invoices card now shows current-month paid revenue in orange alongside all-time totals
- **Dashboard — Recent Invoices** — table below stat cards shows last 5 invoices with clickable invoice #, customer, date, status badge, total
- **Customer invoice history** — customer edit page shows all invoices for that customer below the form (sorted newest first); includes "+ New Invoice" button
- **Product revenue column** — Products list now shows a Revenue column (`units_sold × unit_price`) in green; shows `—` for unsold products
- **Bulk queue status** — checkboxes on every queue item + select-all toggle; bulk action bar appears when any selected: set all to Pending / Printing / Completed in one click; selection clears on filter change

### Session 12 — PDF invoice style updates
- **Colors on printed invoice** — line item colors now render on the PDF: 7×7 colored swatch + color name (+ note if set) stacked below the SKU in the product column; row height auto-expands to fit
- **Darker section backgrounds** — alternating row shading `#dcdcdc`, section boxes (Bill To, Totals, Payment, Notes) `#d0d0d0`; previously barely visible
- **Top margin fix** — `COMPANY_BOX_TOP` increased from 12→28pt; "INVOICE" title was clipping at top of page
- **Column header text** — changed from white to dark/black for legibility against orange header bar
- **SKU text** — darkened from `#888888` to `#555555`

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

- [ ] **Upload screen back navigation** — a way to return to queue without closing the upload modal (deprioritized)

# DECISION — Filament / colors single source of truth

**BuildPlan**: #18 Phase 1
**Decided**: 2026-06-14
**Decided by**: Wiz

## What we picked

**Option D — Collapse `/admin/colors` and `/filament` into one wiz3dtools-internal page.**

The actual pain Wiz felt was managing colors in two admin pages inside
wiz3dtools, not the cross-system mirror with BamBuddy. The BamBuddy
sync stays exactly as it is today — a one-way pull with wiz3dtools
owning curation. Nothing in BamBuddy needs to change.

The two existing wiz3dtools admin pages overlap massively:

| Feature                         | `/admin/colors` | `/filament` |
|---------------------------------|:---------------:|:-----------:|
| Add / edit / delete color       | ✓               | ✓ (admin)   |
| Multi-color flag + secondaries  | ✓ (v1.14.0)     |             |
| Dedupe modal                    | ✓ (v1.13.0)     |             |
| Sync from BamBuddy              | ✓               |             |
| Manufacturer column             | ✓               | ✓           |
| Inventory grams (raw)           | ✓               | ✓           |
| Stock-level pill (Low/Crit/OK)  |                 | ✓           |
| Low / Critical filter chips     |                 | ✓           |
| Total grams summary             |                 | ✓           |
| Per-row inventory progress bar  |                 | ✓           |
| Add Spool button                | ✓               | ✓           |
| Active/Inactive toggle          | ✓               | ✓ (Enable/Disable) |

Two routes, two `AddColorForm`s, two row components, one shared `colors`
table. Every time we add a feature (multi-color, dedupe, BamBuddy sync)
we ship it to one page and silently leave the other behind. That's the
SoT problem in concrete terms.

The fix is structural: one page owns the colors UX, the other goes
away.

## How we'll execute

**Keep `/admin/colors` as the canonical page.** It already has the
heavyweight admin features (multi-color, dedupe, BamBuddy sync). Add
the dashboard widgets from `/filament` to it (stock pills, low/critical
filter chips, total-grams summary, per-row progress bar). Retire
`/filament` + delete `FilamentPage.tsx` + drop the SideNav link.

Phases 2-3 of this BuildPlan carry that out. See the BuildPlan card for
detail; high level:

- **Phase 2** — Add inventory-dashboard widgets to `ColorsPage`
  (stock-status pills, filter chips, total grams in the header, progress
  bars per row).
- **Phase 3** — Retire `/filament`: delete `FilamentPage.tsx`, remove
  the route from `App.tsx`, drop the "Filament Inventory" link from
  `SideNav.tsx`, update CLAUDE.md routes table + nav section.

## Why not the original options (A / B / C)

The original Phase 1 framed this as a cross-system question about which
of BamBuddy or wiz3dtools should be canonical for filament identity.
Wiz explicitly does NOT intend to change BamBuddy or use Spoolman, so
the cross-system framing was off-target:

- **Option A — BamBuddy canonical.** Rejected. Requires BamBuddy
  schema/admin changes Wiz doesn't want to make.
- **Option B — wiz3dtools canonical, BamBuddy as a sync source.**
  Rejected. Same reason — touches BamBuddy code.
- **Option C — Status quo + better fences (drift-check job, etc).**
  Rejected as scope-mismatch. The drift between BamBuddy and
  wiz3dtools wasn't the felt pain; the duplicated wiz3dtools admin UX
  was.
- **Option D — Collapse the two wiz3dtools admin pages.** Picked.
  Solves the actual felt problem, entirely wiz3dtools-internal,
  ~half-day of work across two phases.

The previous v1.13.0 + v1.14.0 dedupe work covered the cross-system
drift to the extent it bites — manufacturer in the identity key,
multi-color flag, BamBuddy-safety guard on merges. No further
cross-system work is needed today.

## Non-goals

- No BamBuddy code changes.
- No Spoolman integration.
- No changes to `colors.id` as the primary FK key (line_item_colors,
  product_colors keep referencing it).
- No changes to the BamBuddy sync direction or trigger.
- `/admin/manufacturers` stays as a separate page — that's a different
  domain (per-mfr spool weights + thresholds).

## Impact analysis (the "what does this break" pass)

### BamBuddy (CT 106 — `https://bambuddy.deckerzoo.com`)
**Zero impact.** The sync is one-way: `bambuddy-sync.service.ts` only
READS BamBuddy's `/api/v1/inventory/colors` and `/api/v1/inventory/spools`.
BamBuddy doesn't know wiz3dtools exists. The "⟳ Sync from BamBuddy"
button stays on the new combined page; the trigger surface, payload
shape, and cron schedule (03:00 local) are untouched.

### wiz3d-prints (storefront on `wiz3dprints.com`)
**Zero impact.** Reads colors via `GET /api/store/colors` from
`wiz3dtools-backend` (API-key auth, separate from the admin UI). The
endpoint, response shape, the underlying `colors` table, and every
consumer call site (`/lib/store-api.ts:getStoreColors`,
PDP `ProductDetailClient`, cart, wholesale catalog) keep working
unchanged. This change is purely frontend-internal to wiz3dtools-admin.

### wiz3dtools-mcp (Jarvis bridge on port 8014)
**Zero impact.** Reads via the same authenticated backend routes — no
UI involved.

### wiz3dtools backend
**Zero impact.** No route changes, no schema migration, no model
changes. The `useColors` hook in the frontend is already shared between
both pages; the merge happens in the consumer, not the producer.

### wiz3dtools frontend
Modest, additive:
- `ColorsPage` gains stock-status pill, filter chips, totals, progress bar.
- `FilamentPage.tsx` deleted; `/filament` route removed; SideNav "Filament
  Inventory" link removed.
- Anyone with `/filament` bookmarked gets a 404. Phase 3 adds a `<Route
  path="/filament" element={<Navigate to="/admin/colors" replace />} />`
  redirect to keep old links working.

### Access-control note (no behavior change, but worth recording)
`/admin/colors` is currently gated by `ProtectedRoute` only (any
authenticated user can view), with admin-only buttons enforced via
backend `requireAdmin` middleware. `/filament` is gated the same way
but renders an admin-vs-viewer split UI (admin sees Add Spool / Enable
toggles; non-admin sees read-only inventory). Phase 2 will port that
same `isAdmin` conditional rendering into ColorsPage so non-admin
users (if any exist in practice — wiz3dtools today is a single-operator
app) still get a clean read-only experience instead of buttons that
silently 403.

If Wiz wants `/admin/colors` to actually require admin role (lock out
read-only viewers), that's a one-line change to add `requireAdmin` to
the route guard — out of scope for this BP, easy follow-up if desired.

# Security Audit Findings

Audit performed: 2026-03-14. All findings from automated + manual review of the codebase.

---

## Status Key
- 🔴 Open
- 🟡 In Progress
- ✅ Fixed
- ⏸ Deferred

---

## Critical

### C1 — Command Injection in PDF Processing
**Status:** ✅ Fixed
**File:** `packages/backend/src/services/pdf.service.ts` lines 25, 84
**Issue:** `execAsync()` called with shell string containing user-controlled file path. A crafted filename with shell metacharacters (`;`, `&&`, `|`) could execute arbitrary commands on the server.
**Fix:** Replace `execAsync(commandString)` with `spawn()` using argument arrays — no shell interpretation.
**Breaking risk:** Low — internal change only.

---

### C2 — SQL Injection Risk in suggestSku()
**Status:** ✅ Fixed
**File:** `packages/backend/src/models/product.model.ts` line ~83
**Issue:** `excludeId` interpolated directly into SQL string (`AND id != ${excludeId}`). Currently safe due to `parseInt`, but not parameterized — violates defense-in-depth.
**Fix:** Use `$2` parameterized query.
**Breaking risk:** None.

---

### C3 — Weak Password Validation
**Status:** ✅ Fixed
**File:** `packages/backend/src/controllers/users.controller.ts` lines 50-54
**Issue:** Password reset only checks `length >= 1`. Trivially weak passwords accepted.
**Fix:** Enforce minimum 12 characters.
**Breaking risk:** Low — only affects new password creation.

---

## High

### H1 — No Rate Limiting on Login / API Routes
**Status:** ✅ Fixed
**File:** `packages/backend/src/index.ts`, `packages/backend/src/routes/auth.routes.ts`
**Issue:** Only upload endpoint has rate limiting. Login endpoint open to brute-force. All API routes open to DoS.
**Fix:** Global rate limit on `/api/*` (100 req/15min); strict limit on `/api/auth/login` (10 req/15min).
**Breaking risk:** Low.

---

### H2 — CORS Open to All Origins
**Status:** ✅ Fixed
**File:** `packages/backend/src/index.ts` line ~27
**Issue:** `origin: true` allows any website to make credentialed requests to the API (CSRF vector).
**Fix:** Restrict to known frontend domains via `CORS_ORIGIN` env var.
**Breaking risk:** Low-Medium — must set env var correctly for production domain.

---

### H3 — JWT Expiry Too Long (7 Days)
**Status:** ✅ Fixed (interim)
**File:** `packages/backend/src/services/auth.service.ts` line ~22
**Issue:** Stolen tokens valid for a full week. No refresh token mechanism.
**Fix:** Reduced to 24h. Full refresh token implementation deferred.
**Breaking risk:** Low — users log in again after 24h of inactivity.

---

### H4 — JWT Secret Not Validated for Strength
**Status:** ✅ Fixed
**File:** `packages/backend/src/services/auth.service.ts` lines 14-18
**Issue:** Only checks JWT_SECRET exists, not that it's cryptographically strong.
**Fix:** Enforce minimum 32-character length at startup.
**Breaking risk:** Low — startup check only; existing strong secrets unaffected.

---

### H5 — No HTTPS / HSTS
**Status:** ✅ Fixed
**File:** `infrastructure/docker/nginx.conf`
**Issue:** Only HTTP. Tokens and data transmitted in plaintext. No HSTS header.
**Fix:** Add SSL cert (Let's Encrypt), redirect HTTP → HTTPS, add HSTS header.
**Breaking risk:** Medium — requires cert setup; misconfiguration takes site down.

---

### H6 — No Content-Security-Policy Header
**Status:** ✅ Fixed
**File:** `infrastructure/docker/nginx.conf`
**Issue:** No CSP — XSS attacks can load external scripts freely.
**Fix:** Add CSP header allowing self + Google Fonts CDN + inline styles.
**Breaking risk:** Medium — Poppins font (Google CDN) needs explicit `font-src` allowance.

---

### H7 — JWT Stored in localStorage (XSS Risk)
**Status:** ✅ Fixed
**File:** `packages/frontend/src/context/AuthContext.tsx`, `packages/backend/src/controllers/auth.controller.ts`
**Issue:** localStorage is readable by any JavaScript on the page. XSS attack can steal JWT.
**Fix:** JWT now stored in HttpOnly `wiz3d_token` cookie (`SameSite=Strict`, `Secure` in production). `AuthContext` restored via `/api/auth/me` on mount. `api.ts` uses `withCredentials: true`. Logout clears cookie server-side via `POST /api/auth/logout`.
**Breaking risk:** High — full auth flow refactor.

---

### H8 — File Upload MIME Type Validation Client-Controlled
**Status:** ✅ Fixed
**File:** `packages/backend/src/middleware/upload.middleware.ts` lines 27-35
**Issue:** MIME type check uses `file.mimetype` which comes from the client and can be spoofed. A malicious file could be uploaded disguised as a PDF.
**Fix:** Validate actual file magic bytes (`%PDF`) after upload, reject and delete if invalid.
**Breaking risk:** Low — only affects malformed/malicious uploads.

---

### H9 — Stack Traces Exposed in Non-Production
**Status:** ✅ Fixed
**File:** `packages/backend/src/middleware/error-handler.ts` line ~58
**Issue:** `err.message` returned to client in non-production environments, leaking internal details.
**Fix:** Always return generic error message to client; log details server-side only.
**Breaking risk:** None.

---

## Medium

### M1 — No Input Validation on Request Bodies
**Status:** ✅ Fixed
**Issue:** All controllers pass `req.body` directly to services without schema validation. Allows over-posting, type confusion, excessively long strings.
**Fix:** Zod validation schemas added to all 8 controllers (auth, users, queue, upload, customer, product, sales-invoice, color). Invalid input returns 400 with field-level error messages.
**Breaking risk:** Low — rejects invalid input that currently passes through.

---

### M2 — No CSRF Protection
**Status:** ✅ Fixed
**Issue:** No CSRF tokens on state-changing endpoints. Mitigated partially by Bearer token auth but not fully if CORS is open.
**Fix:** CSRF token (48-char hex) embedded in JWT payload, returned in login/register/me response body. Frontend stores in React state only; sends as `X-CSRF-Token` header on all POST/PUT/PATCH/DELETE. `requireAuth` middleware validates token on mutating requests.
**Breaking risk:** Low-Medium.

---

### M3 — No Audit Logging
**Status:** ✅ Fixed
**Issue:** No persistent log of sensitive actions (user creation, invoice changes, status updates). Console logs are ephemeral.
**Fix:** Added `audit_logs` table (migration 018); logs actor, action, resource, detail, timestamp on: user create/update/delete/reset-password, invoice create/delete/send/ship/send-to-queue.
**Breaking risk:** None — additive only.

---

### M4 — No Session Timeout / Activity Monitoring
**Status:** ✅ Fixed
**Issue:** Tokens valid 7 days with no activity-based expiry.
**Fix:** 30min idle timer in AuthContext; 60-second countdown warning modal before auto-logout.
**Breaking risk:** Low.

---

### M5 — No Database Connection SSL
**Status:** ✅ Fixed
**File:** `packages/backend/src/config/database.ts`
**Issue:** No `ssl` option in pg pool config. If DB is remote, credentials/data sent in plaintext.
**Fix:** Enable `ssl: { rejectUnauthorized: false }` for production.
**Breaking risk:** Low — config-only change.

---

### M6 — Upload Directory Path Not Validated
**Status:** ✅ Fixed
**File:** `packages/backend/src/middleware/upload.middleware.ts`
**Issue:** `UPLOAD_DIR` env var used without path traversal validation.
**Fix:** Resolve and validate path stays within expected root at startup.
**Breaking risk:** None.

---

### M7 — No Email Format Validation on Customer
**Status:** ✅ Fixed
**Issue:** Customer email stored without format validation. Malformed emails silently saved.
**Fix:** Validate email format in customer create/update controller.
**Breaking risk:** Low — rejects invalid emails on write.

---

### M8 — No Rate Limiting on Password Reset
**Status:** ✅ Fixed
**File:** `packages/backend/src/routes/users.routes.ts`
**Issue:** Admin password reset endpoint has no rate limiting.
**Fix:** Add rate limiter to password reset route (5 req/15min).
**Breaking risk:** None.

---

### M9 — No Logging of Auth Failures
**Status:** ✅ Fixed
**File:** `packages/backend/src/services/auth.service.ts`
**Issue:** Failed login attempts not logged — brute-force attacks invisible.
**Fix:** Log failed attempts with timestamp and username (not password).
**Breaking risk:** None.

---

## Low / Info

### L1 — Missing Security Headers
**Status:** ✅ Fixed
**Fix:** Added `Referrer-Policy` and `Permissions-Policy` to nginx (both server and static file location blocks).

### L2 — Dependency Versions Use Caret Ranges
**Status:** ✅ Fixed (audit)
**Fix:** Ran `npm audit fix` — patched multer (3 high DoS CVEs). Caret ranges remain; audit should be run regularly.

### L3 — Ollama Model Name Not Whitelisted
**Status:** ✅ Fixed
**Fix:** Validate `OLLAMA_MODEL` against an allowlist at startup; exits if not recognized.

---

## Fix Order

### Immediate (zero/low breaking risk)
- [x] ~~C1 — Command injection~~
- [x] ~~C2 — suggestSku parameterization~~
- [x] ~~C3 — Password minimum length~~
- [x] ~~H1 — Rate limiting~~
- [x] ~~H4 — JWT secret strength check~~
- [x] ~~H8 — PDF magic byte validation~~
- [x] ~~H9 — Error handler message leak~~

### Careful (test before deploying)
- [x] ~~H2 — CORS restriction~~
- [x] ~~H5 — HTTPS / HSTS~~
- [x] ~~H6 — Content-Security-Policy~~

### Plan properly
- [x] ~~H3 — JWT expiry (24h)~~
- [x] ~~H7 — JWT → HttpOnly cookies~~
- [x] ~~M1 — Input validation (Zod)~~
- [x] ~~M2 — CSRF protection~~
- [x] ~~M3 — Audit logging~~

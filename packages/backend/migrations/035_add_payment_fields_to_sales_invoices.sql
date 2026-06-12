-- Migration 035 — Track payment provider + reference on sales_invoices.
--
-- BuildPlan #12 Phase 2 (Consumer Ecommerce). The new
-- POST /api/store/orders/:id/mark-paid endpoint records who paid the
-- invoice (stripe | paypal | manual) and the provider-side reference id
-- (Stripe PaymentIntent id, PayPal capture id, etc.) so downstream
-- audits + refunds can find the original charge without grepping logs.
--
-- paid_at parallels sent_at + shipped_at so future order-history pages
-- can render a "Paid on …" timestamp without re-deriving it from
-- updated_at.
--
-- All three columns nullable: pre-existing invoices remain valid; the
-- mark-paid endpoint stamps them on the first paid transition only
-- (idempotent — second call is a no-op since status='paid').

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

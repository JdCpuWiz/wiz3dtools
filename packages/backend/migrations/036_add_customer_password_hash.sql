-- Change #148 F7 — per-customer auth on the store API.
-- Adds a nullable password_hash column on customers. Existing rows
-- (wholesale-only customers, who never log in via the consumer flow)
-- stay null. Consumer signup on wiz3d-prints hashes + writes on
-- account creation; consumer login on wiz3d-prints verifies and asks
-- wiz3dtools to mint a short-lived store-customer-token bound to the
-- customer's id. Null password_hash = "cannot use consumer flows yet",
-- which is the correct semantics for the wholesale-only customers
-- that pre-existed this column.

ALTER TABLE customers ADD COLUMN password_hash TEXT;

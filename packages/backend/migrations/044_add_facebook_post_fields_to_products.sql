-- Change #442 — Facebook auto-posting for Wiz3D Prints products.
--
-- Two nullable columns on products. `facebook_post_id` doubles as the
-- "already posted" marker: NULL means never posted (or the last attempt
-- failed), so the admin's "Post to Facebook" button stays a retry. It
-- holds Graph's `post_id` ("{page-id}_{post-id}"), which is also what
-- https://facebook.com/{post_id} resolves to.
--
-- Design doc: wiz3d-prints/docs/SOCIAL_POSTING.md (C438 investigation).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS facebook_post_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facebook_posted_at TIMESTAMP;

COMMENT ON COLUMN products.facebook_post_id IS
  'Graph API post_id of the Facebook Page post for this product. NULL = never posted; doubles as the "already posted" marker.';
COMMENT ON COLUMN products.facebook_posted_at IS
  'When the product was posted to the Facebook Page.';

-- BP17 Phase 2 — per-image alpha masks for dynamic product color preview.
-- One row per (image, color slot). slot_index matches product_colors.sort_order
-- for the same product (the recipe position the customer's picker slot maps to).
-- url points at a PNG with the mask in its ALPHA channel, stored alongside the
-- base image under the uploads dir (local disk, like product_images.url — the
-- BuildPlan's R2 key convention predates checking how images are actually stored).
CREATE TABLE product_image_masks (
  id          SERIAL PRIMARY KEY,
  image_id    INT          NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
  slot_index  INT          NOT NULL,
  url         VARCHAR(500) NOT NULL,
  source      VARCHAR(20)  NOT NULL
              CHECK (source IN ('AUTO_REMBG', 'AUTO_REMOVEBG', 'MANUAL_UPLOAD')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (image_id, slot_index)
);

CREATE INDEX idx_product_image_masks_image_id ON product_image_masks(image_id);

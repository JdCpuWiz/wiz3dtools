-- Per-color filament weight assignments for products (from slicer data)
CREATE TABLE product_colors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
  weight_grams DECIMAL(8,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, color_id)
);

CREATE INDEX idx_product_colors_product_id ON product_colors(product_id);

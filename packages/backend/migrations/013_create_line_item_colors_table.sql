CREATE TABLE line_item_colors (
  id SERIAL PRIMARY KEY,
  line_item_id INTEGER NOT NULL REFERENCES invoice_line_items(id) ON DELETE CASCADE,
  color_id INTEGER NOT NULL REFERENCES colors(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  note VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

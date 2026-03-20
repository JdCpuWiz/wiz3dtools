-- Add filament weight tracking to line item and queue item color assignments
ALTER TABLE line_item_colors
  ADD COLUMN weight_grams DECIMAL(8,2) NOT NULL DEFAULT 0;

ALTER TABLE queue_item_colors
  ADD COLUMN weight_grams DECIMAL(8,2) NOT NULL DEFAULT 0;

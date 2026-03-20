-- Add manufacturer reference and inventory tracking to colors
ALTER TABLE colors
  ADD COLUMN manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN inventory_grams DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Link all existing colors to Bambu Lab
UPDATE colors
SET manufacturer_id = (SELECT id FROM manufacturers WHERE name = 'Bambu Lab');

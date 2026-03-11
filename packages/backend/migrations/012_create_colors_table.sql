CREATE TABLE colors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  hex VARCHAR(7) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO colors (name, hex, sort_order) VALUES
  ('Black', '#1a1a1a', 0),
  ('White', '#f5f5f5', 1),
  ('Red', '#dc2626', 2),
  ('Blue', '#2563eb', 3),
  ('Green', '#16a34a', 4),
  ('Yellow', '#ca8a04', 5),
  ('Orange', '#ea580c', 6),
  ('Purple', '#9333ea', 7),
  ('Pink', '#db2777', 8),
  ('Gray', '#6b7280', 9),
  ('Silver', '#cbd5e1', 10),
  ('Gold', '#d97706', 11),
  ('Clear/Natural', '#e5e7eb', 12),
  ('Brown', '#92400e', 13);

CREATE TABLE manufacturers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  empty_spool_weight_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  full_spool_net_weight_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  low_threshold_g DECIMAL(8,2) NOT NULL DEFAULT 500,
  critical_threshold_g DECIMAL(8,2) NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Bambu Lab as the default manufacturer
-- empty spool: 242g, full spool gross: 1249g, net filament: 1007g
INSERT INTO manufacturers (name, empty_spool_weight_g, full_spool_net_weight_g, low_threshold_g, critical_threshold_g)
VALUES ('Bambu Lab', 242, 1007, 500, 200);

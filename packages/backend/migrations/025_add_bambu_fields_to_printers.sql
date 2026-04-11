-- Migration 025: Add Bambu printer configuration fields
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS ip_address   VARCHAR(45),
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS access_code  VARCHAR(100);

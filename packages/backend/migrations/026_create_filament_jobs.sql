-- Migration 026: Filament jobs — pending filament deduction queue from Bambu monitor
CREATE TABLE IF NOT EXISTS filament_jobs (
  id              SERIAL PRIMARY KEY,
  printer_id      INTEGER REFERENCES printers(id) ON DELETE SET NULL,
  job_name        VARCHAR(255),
  ams_slot_id     VARCHAR(10),        -- e.g. "0.1" (AMS unit 0, tray 1)
  ams_color_hex   VARCHAR(10),        -- hex from RFID tag e.g. "FF0000FF"
  ams_material    VARCHAR(50),        -- "PLA", "PETG", etc.
  remain_start    DECIMAL(5,2),       -- AMS remain % at print start
  remain_end      DECIMAL(5,2),       -- AMS remain % at print finish
  filament_grams  DECIMAL(8,2),       -- computed grams deducted (set when resolved)
  color_id        INTEGER REFERENCES colors(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- pending | auto_resolved | resolved | skipped
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_filament_jobs_status    ON filament_jobs(status);
CREATE INDEX IF NOT EXISTS idx_filament_jobs_printer   ON filament_jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_filament_jobs_created   ON filament_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  actor       VARCHAR(100) NOT NULL,           -- username of the user performing the action
  action      VARCHAR(100) NOT NULL,           -- e.g. 'user.create', 'invoice.ship'
  resource    VARCHAR(100),                    -- e.g. 'user:5', 'invoice:INV-0023'
  detail      TEXT,                            -- optional extra context (JSON or plain text)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor      ON audit_logs(actor);
CREATE INDEX idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

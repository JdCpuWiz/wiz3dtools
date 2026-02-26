CREATE SEQUENCE IF NOT EXISTS sales_invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS sales_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft',
  tax_rate DECIMAL(5,4) DEFAULT 0.15,
  tax_exempt BOOLEAN DEFAULT FALSE,
  notes TEXT,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sales_invoices_status_valid CHECK (status IN ('draft','sent','paid','cancelled'))
);

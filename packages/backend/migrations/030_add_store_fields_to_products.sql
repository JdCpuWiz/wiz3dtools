ALTER TABLE products
  ADD COLUMN published_to_store  BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN category_id         INT            NULL REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN store_title         VARCHAR(255),
  ADD COLUMN store_description   TEXT,
  ADD COLUMN wholesale_price     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  ADD COLUMN retail_price        DECIMAL(10,2)  NOT NULL DEFAULT 0;

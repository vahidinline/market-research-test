CREATE TABLE IF NOT EXISTS apify_raw_parts (
  collection_key TEXT NOT NULL,
  part INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (collection_key, part)
);

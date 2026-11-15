CREATE TABLE IF NOT EXISTS apify_collections (
  collection_key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  input TEXT NOT NULL,
  run_id TEXT,
  state TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);

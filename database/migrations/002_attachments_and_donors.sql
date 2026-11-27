CREATE TABLE IF NOT EXISTS donors (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS donors_user_idx ON donors(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS donors_user_name_idx ON donors (user_id, lower(btrim(name)));

ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_size_bytes_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_size_bytes_check CHECK (size_bytes BETWEEN 1 AND 5242880);
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_mime_type_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_mime_type_check CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_entity_type_check CHECK (entity_type IN ('transaction', 'card_purchase', 'invoice', 'account'));
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_filename_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_filename_check CHECK (char_length(filename) BETWEEN 1 AND 180);
CREATE UNIQUE INDEX IF NOT EXISTS attachments_storage_key_idx ON attachments(storage_key);

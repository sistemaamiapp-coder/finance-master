CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS workspaces (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity text NOT NULL DEFAULT '',
  ref text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes >= 0),
  storage_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments(user_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS accounts (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS categories (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subcategory text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, name, subcategory, type)
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('receita', 'despesa')),
  account_id text NOT NULL,
  section text NOT NULL DEFAULT '',
  transaction_date date NOT NULL,
  due_date date,
  group_id text,
  recurrence_id text,
  occurrence_date date,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, recurrence_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS transactions_month_idx ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS transactions_due_idx ON transactions(user_id, due_date);

CREATE TABLE IF NOT EXISTS transaction_payments (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  payment_date date NOT NULL,
  account_id text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transfers (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_account text NOT NULL,
  to_account text NOT NULL,
  transfer_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  invoice_month text,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  CHECK (from_account <> to_account)
);
CREATE INDEX IF NOT EXISTS transfers_date_idx ON transfers(user_id, transfer_date);

CREATE TABLE IF NOT EXISTS bills (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  due_date date,
  status text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, transaction_id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  institution text NOT NULL DEFAULT '',
  closing_day integer NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  limit_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (limit_amount >= 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, account_id)
);

CREATE TABLE IF NOT EXISTS card_purchases (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  card_id text NOT NULL,
  purchase_date date NOT NULL,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, transaction_id),
  FOREIGN KEY (user_id, transaction_id) REFERENCES transactions(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, card_id) REFERENCES credit_cards(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS installments (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id text NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, purchase_id, number),
  FOREIGN KEY (user_id, purchase_id) REFERENCES card_purchases(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  reference_month text NOT NULL,
  closing_date date NOT NULL,
  due_date date NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, card_id, reference_month),
  FOREIGN KEY (user_id, card_id) REFERENCES credit_cards(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id text NOT NULL,
  transfer_id text NOT NULL,
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, transfer_id),
  FOREIGN KEY (user_id, invoice_id) REFERENCES invoices(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  budget numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id text NOT NULL,
  name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  purchased boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, list_id) REFERENCES shopping_lists(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_id text NOT NULL,
  target_amount numeric(14,2) NOT NULL CHECK (target_amount > 0),
  target_date date,
  status text NOT NULL DEFAULT 'active',
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS goal_movements (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('deposito', 'retirada')),
  movement_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  transfer_id text,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, goal_id) REFERENCES savings_goals(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budgets (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  category text NOT NULL,
  cost_center text NOT NULL DEFAULT '',
  planned_amount numeric(14,2) NOT NULL CHECK (planned_amount >= 0),
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, reference_month, category, cost_center)
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description text NOT NULL,
  frequency text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  remind_at timestamptz,
  priority text NOT NULL DEFAULT 'normal',
  completed boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS settings (
  id text NOT NULL DEFAULT 'default',
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

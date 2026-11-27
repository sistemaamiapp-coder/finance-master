import pg from "pg";
import { createEmptyState, cardInvoice, invoiceMonthForDate, monthKey, remaining, isCancelled, todayISO } from "../services/finance.js";

const { Pool } = pg;

export class PostgresRepository {
  constructor(connectionString) {
    if (!connectionString) throw new Error("DATABASE_URL é obrigatória.");
    this.pool = new pg.Pool({ connectionString, max: 10, statement_timeout: 15000, idle_in_transaction_session_timeout: 15000 });
  }

  async createUser(user) {
    const result = await this.pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at, updated_at",
      [user.email, user.passwordHash, user.name]
    );
    const record = result.rows[0];
    await this.saveWorkspace(record.id, createEmptyState(record), 0);
    return record;
  }

  async findUserByEmail(email) {
    const result = await this.pool.query("SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
  }

  async findUserById(id) {
    const result = await this.pool.query("SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  async updatePassword(id, passwordHash) {
    await this.pool.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [id, passwordHash]);
  }

  async updateProfile(id, name) {
    const result = await this.pool.query("UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, email, name, created_at, updated_at", [id, name]);
    if (!result.rows[0]) throw new Error("Usuária não encontrada.");
    return result.rows[0];
  }

  async createSession(session) {
    const result = await this.pool.query(
      "INSERT INTO sessions (user_id, token_hash, csrf_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, user_id, token_hash, csrf_hash, created_at, expires_at, revoked_at",
      [session.userId, session.tokenHash, session.csrfHash, session.expiresAt]
    );
    return result.rows[0];
  }

  async findSession(tokenHash) {
    const result = await this.pool.query(
      `SELECT s.id, s.user_id, s.token_hash, s.csrf_hash, s.created_at, s.expires_at, s.revoked_at, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  async revokeSession(tokenHash) {
    await this.pool.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash]);
  }

  async revokeOtherSessions(userId, currentTokenHash) {
    await this.pool.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL", [userId, currentTokenHash]);
  }

  async getWorkspace(userId) {
    const result = await this.pool.query("SELECT state, revision FROM workspaces WHERE user_id = $1", [userId]);
    if (!result.rows[0]) return null;
    return { state: result.rows[0].state, revision: Number(result.rows[0].revision) };
  }

  async saveWorkspace(userId, state, expectedRevision) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT revision FROM workspaces WHERE user_id = $1 FOR UPDATE", [userId]);
      const revision = current.rows[0] ? Number(current.rows[0].revision) : 0;
      if (revision !== Number(expectedRevision)) {
        const error = new Error("Conflito de revisão.");
        error.code = "REVISION_CONFLICT";
        throw error;
      }
      await client.query(
        `INSERT INTO workspaces (user_id, revision, state, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET revision = EXCLUDED.revision, state = EXCLUDED.state, updated_at = now()`,
        [userId, revision + 1, JSON.stringify(state)]
      );
      await this.replaceProjections(client, userId, state);
      await client.query("COMMIT");
      return { state, revision: revision + 1 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceProjections(client, userId, state) {
    const tables = [
      "invoice_payments", "installments", "card_purchases", "invoices", "goal_movements", "shopping_items",
      "transaction_payments", "bills", "transfers", "transactions", "recurring_transactions", "reminders",
      "budgets", "savings_goals", "shopping_lists", "credit_cards", "payment_methods", "cost_centers",
      "donors", "categories", "accounts", "settings", "audit_events",
    ];
    for (const table of tables) await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);

    const insert = async (table, columns, rows) => {
      for (const row of rows) {
        const values = columns.map((column) => row[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`, values);
      }
    };

    await insert("accounts", ["id", "user_id", "name", "type", "active", "payload"], state.accounts.map((account) => ({
      id: account.id, user_id: userId, name: account.name, type: account.type, active: account.active !== false, payload: JSON.stringify(account),
    })));
    await insert("categories", ["id", "user_id", "name", "subcategory", "type", "payload"], state.categories.map((category) => ({
      id: category.id, user_id: userId, name: category.name, subcategory: category.subcategory, type: category.type, payload: JSON.stringify(category),
    })));
    await insert("cost_centers", ["id", "user_id", "name", "payload"], state.costCenters.map((center) => ({
      id: center.id, user_id: userId, name: center.name, payload: JSON.stringify(center),
    })));
    await insert("payment_methods", ["id", "user_id", "name", "payload"], (state.settings.methods || []).map((name, index) => ({
      id: `METHOD-${index + 1}`, user_id: userId, name, payload: JSON.stringify({ name }),
    })));
    await insert("donors", ["id", "user_id", "name", "contact", "note", "active", "payload"], (state.donors || []).map((donor) => ({
      id: donor.id, user_id: userId, name: donor.name, contact: donor.contact || "", note: donor.note || "",
      active: donor.active !== false, payload: JSON.stringify(donor),
    })));
    await insert("transactions", ["id", "user_id", "type", "account_id", "section", "transaction_date", "due_date", "group_id", "recurrence_id", "occurrence_date", "amount", "payload"], state.transactions.map((tx) => ({
      id: tx.id, user_id: userId, type: tx.type, account_id: tx.account, section: tx.section || "", transaction_date: tx.date,
      due_date: tx.dueDate || null, group_id: tx.groupId || null, recurrence_id: tx.recurrenceId || null,
      occurrence_date: tx.occurrenceDate || null, amount: tx.amount, payload: JSON.stringify(tx),
    })));
    await insert("transaction_payments", ["id", "user_id", "transaction_id", "payment_date", "account_id", "amount", "payload"], state.transactions.flatMap((tx) => (tx.payments || []).map((payment) => ({
      id: payment.id, user_id: userId, transaction_id: tx.id, payment_date: payment.date,
      account_id: payment.account || tx.account, amount: payment.amount, payload: JSON.stringify(payment),
    }))));
    await insert("transfers", ["id", "user_id", "from_account", "to_account", "transfer_date", "amount", "invoice_month", "payload"], state.transfers.map((transfer) => ({
      id: transfer.id, user_id: userId, from_account: transfer.fromAccount, to_account: transfer.toAccount,
      transfer_date: transfer.date, amount: transfer.amount, invoice_month: transfer.invoiceMonth || null, payload: JSON.stringify(transfer),
    })));
    await insert("bills", ["id", "user_id", "transaction_id", "due_date", "status", "payload"], state.transactions.filter((tx) => tx.dueDate).map((tx) => ({
      id: `BILL-${tx.id}`, user_id: userId, transaction_id: tx.id, due_date: tx.dueDate,
      status: isCancelled(tx) ? "Cancelado" : remaining(tx) <= 0 ? (tx.type === "receita" ? "Recebido" : "Pago") : tx.dueDate < todayISO() ? "Atrasado" : "Pendente",
      payload: JSON.stringify(tx),
    })));

    const cards = state.accounts.filter((account) => account.type === "Cartão de crédito");
    await insert("credit_cards", ["id", "user_id", "account_id", "institution", "closing_day", "due_day", "limit_amount", "payload"], cards.map((card) => ({
      id: card.id, user_id: userId, account_id: card.id, institution: card.institution || "", closing_day: card.closingDay || 31,
      due_day: card.dueDay || 31, limit_amount: card.limit || 0, payload: JSON.stringify(card),
    })));
    const purchases = state.transactions.filter((tx) => tx.section === "Cartão de crédito" && cards.some((card) => card.id === tx.account));
    const purchaseGroups = new Map();
    purchases.forEach((tx) => {
      const purchaseId = tx.cardPurchaseId || (tx.groupId ? `PUR-${tx.groupId}` : `PUR-${tx.id}`);
      const group = purchaseGroups.get(purchaseId) || { id: purchaseId, cardId: tx.account, transactionId: tx.id, date: tx.date, total: 0, items: [] };
      group.total += Number(tx.amount);
      if (tx.date < group.date) group.date = tx.date;
      group.items.push(tx);
      purchaseGroups.set(purchaseId, group);
    });
    await insert("card_purchases", ["id", "user_id", "transaction_id", "card_id", "purchase_date", "total_amount", "payload"], [...purchaseGroups.values()].map((group) => ({
      id: group.id, user_id: userId, transaction_id: group.transactionId, card_id: group.cardId,
      purchase_date: group.date, total_amount: group.total.toFixed(2), payload: JSON.stringify({ cardId: group.cardId, transactionIds: group.items.map((tx) => tx.id) }),
    })));
    await insert("installments", ["id", "user_id", "purchase_id", "number", "due_date", "amount", "payload"], purchases.filter((tx) => tx.installmentNumber).map((tx) => ({
      id: `INS-${tx.id}`, user_id: userId, purchase_id: tx.cardPurchaseId || `PUR-${tx.groupId || tx.id}`,
      number: tx.installmentNumber, due_date: tx.dueDate || tx.date, amount: tx.amount, payload: JSON.stringify(tx),
    })));

    const invoiceRows = [];
    for (const card of cards) {
      const months = new Set(purchases.filter((tx) => tx.account === card.id).map((tx) => tx.invoiceMonth || invoiceMonthForDate(card, tx.date)));
      state.transfers.filter((transfer) => transfer.toAccount === card.id && transfer.invoiceMonth).forEach((transfer) => months.add(transfer.invoiceMonth));
      months.add(todayISO().slice(0, 7));
      for (const month of months) {
        const invoice = cardInvoice(state, card.id, month);
        invoiceRows.push({
          id: `INV-${card.id}-${month}`, user_id: userId, card_id: card.id, reference_month: month,
          closing_date: invoice.closingDate, due_date: invoice.dueDate, total_amount: invoice.total,
          paid_amount: invoice.paid, status: invoice.status, payload: JSON.stringify(invoice),
        });
      }
    }
    await insert("invoices", ["id", "user_id", "card_id", "reference_month", "closing_date", "due_date", "total_amount", "paid_amount", "status", "payload"], invoiceRows);
    await insert("invoice_payments", ["id", "user_id", "invoice_id", "transfer_id", "payment_date", "amount", "payload"], state.transfers.filter((transfer) => cards.some((card) => card.id === transfer.toAccount) && transfer.invoiceMonth).map((transfer) => ({
      id: `INVPAY-${transfer.id}`, user_id: userId, invoice_id: `INV-${transfer.toAccount}-${transfer.invoiceMonth}`,
      transfer_id: transfer.id, payment_date: transfer.date, amount: transfer.amount, payload: JSON.stringify(transfer),
    })));

    await insert("shopping_lists", ["id", "user_id", "name", "status", "budget", "payload"], state.shoppingLists.map((list) => ({
      id: list.id, user_id: userId, name: list.name, status: list.status || "active", budget: list.budget || 0, payload: JSON.stringify(list),
    })));
    await insert("shopping_items", ["id", "user_id", "list_id", "name", "quantity", "purchased", "payload"], state.shoppingLists.flatMap((list) => (list.items || []).map((item) => ({
      id: item.id, user_id: userId, list_id: list.id, name: item.name, quantity: item.quantity || 1,
      purchased: !!item.purchased, payload: JSON.stringify(item),
    }))));
    await insert("savings_goals", ["id", "user_id", "name", "account_id", "target_amount", "target_date", "status", "payload"], state.goals.map((goal) => ({
      id: goal.id, user_id: userId, name: goal.name, account_id: goal.account, target_amount: goal.target,
      target_date: goal.targetDate || null, status: goal.status || "active", payload: JSON.stringify(goal),
    })));
    await insert("goal_movements", ["id", "user_id", "goal_id", "movement_type", "movement_date", "amount", "transfer_id", "payload"], state.goals.flatMap((goal) => (goal.movements || []).map((movement) => ({
      id: movement.id, user_id: userId, goal_id: goal.id, movement_type: movement.type, movement_date: movement.date,
      amount: movement.amount, transfer_id: movement.transferId || null, payload: JSON.stringify(movement),
    }))));
    await insert("budgets", ["id", "user_id", "reference_month", "category", "cost_center", "planned_amount", "payload"], state.budgets.map((budget) => ({
      id: budget.id, user_id: userId, reference_month: budget.month, category: budget.category,
      cost_center: budget.costCenter || "", planned_amount: budget.planned, payload: JSON.stringify(budget),
    })));
    await insert("recurring_transactions", ["id", "user_id", "description", "frequency", "start_date", "end_date", "active", "payload"], state.recurring.map((rule) => ({
      id: rule.id, user_id: userId, description: rule.description, frequency: rule.frequency, start_date: rule.startDate,
      end_date: rule.endDate || null, active: rule.active !== false && !["paused", "ended"].includes(rule.status), payload: JSON.stringify(rule),
    })));
    await insert("reminders", ["id", "user_id", "title", "remind_at", "priority", "completed", "payload"], state.reminders.map((reminder) => ({
      id: reminder.id, user_id: userId, title: reminder.title, remind_at: reminder.remindAt ? new Date(reminder.remindAt).toISOString() : null,
      priority: reminder.priority || "normal", completed: !!reminder.completed, payload: JSON.stringify(reminder),
    })));
    await insert("settings", ["id", "user_id", "payload"], [{ id: "default", user_id: userId, payload: JSON.stringify(state.settings) }]);
    await insert("audit_events", ["id", "user_id", "action", "entity", "ref", "detail", "created_at", "payload"], state.audit.map((event) => ({
      id: event.id, user_id: userId, action: event.action, entity: event.entity || "", ref: event.ref || "",
      detail: event.detail || "", created_at: event.ts || new Date().toISOString(), payload: JSON.stringify(event),
    })));
  }

  async createAttachment(attachment) {
    const result = await this.pool.query(
      `INSERT INTO attachments (user_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, user_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key, created_at`,
      [attachment.userId, attachment.entityType, attachment.entityId, attachment.filename, attachment.mimeType, attachment.sizeBytes, attachment.storageKey]
    );
    return result.rows[0];
  }

  async listAttachments(userId, entityType, entityId) {
    const result = await this.pool.query(
      "SELECT id, user_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key, created_at FROM attachments WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC",
      [userId, entityType, entityId]
    );
    return result.rows;
  }

  async listAllAttachments(userId) {
    const result = await this.pool.query("SELECT id, user_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key, created_at FROM attachments WHERE user_id = $1", [userId]);
    return result.rows;
  }

  async findAttachment(userId, attachmentId) {
    const result = await this.pool.query(
      "SELECT id, user_id, entity_type, entity_id, filename, mime_type, size_bytes, storage_key, created_at FROM attachments WHERE user_id = $1 AND id = $2",
      [userId, attachmentId]
    );
    return result.rows[0] || null;
  }

  async deleteAttachment(userId, attachmentId) {
    const result = await this.pool.query("DELETE FROM attachments WHERE user_id = $1 AND id = $2 RETURNING id", [userId, attachmentId]);
    return result.rows[0] || null;
  }

  async deleteUser(userId) {
    await this.pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }

  async close() {
    await this.pool.end();
  }
}

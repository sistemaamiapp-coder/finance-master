export const STATE_VERSION = 3;
export const PRODUCT_NAME = "Meu Lar Financeiro";

export const DEFAULT_CATEGORIES = [
  ["Receitas", "Entradas", "Receita", "Salário, renda extra, benefícios, vendas e outros recebimentos."],
  ["Moradia", "Aluguel e condomínio", "Despesa", "Aluguel, condomínio e taxas de moradia."],
  ["Alimentação", "Mercado e restaurantes", "Despesa", "Compras de casa, refeições e delivery."],
  ["Saúde", "Consultas e medicamentos", "Despesa", "Saúde, academia, consultas e medicamentos."],
  ["Transporte", "Combustível e locomoção", "Despesa", "Uber, transporte público, combustível e manutenção."],
  ["Educação", "Cursos e escola", "Despesa", "Escola, cursos, livros e desenvolvimento."],
  ["Beleza e cuidados", "Pessoal", "Despesa", "Beleza, cabelo, pele e cuidados pessoais."],
  ["Lazer", "Passeios e presentes", "Despesa", "Lazer, viagens, festas e presentes."],
  ["Compras pessoais", "Vestuário e eletrônicos", "Despesa", "Roupas, calçados e eletrônicos."],
  ["Contas domésticas", "Água, luz e internet", "Despesa", "Contas da casa, internet, telefonia e impostos."],
  ["Assinaturas", "Serviços recorrentes", "Despesa", "Streaming, aplicativos e serviços recorrentes."],
  ["Outros", "Despesas diversas", "Despesa", "Despesas que não se encaixam nas demais categorias."],
];

export const ACCOUNT_TYPES = ["Conta corrente", "Poupança", "Caixa", "Cartão de crédito", "Investimento", "Outro"];
export const COLLECTIONS = [
  "accounts", "categories", "costCenters", "transactions", "transfers", "budgets",
  "reconciliations", "installmentGroups", "goals", "shoppingLists", "recurring", "reminders", "donors", "audit",
];

const LEGACY_ORGS = new Set(["Luvis Finance", "Ministério AMI", "Minha organização", "Livis Finance"]);
const LEGACY_CATEGORY_MAP = {
  Mercado: ["Alimentação", "Mercado e restaurantes"],
  Necessidades: ["Saúde", "Consultas e medicamentos"],
  Eletrônicos: ["Compras pessoais", "Vestuário e eletrônicos"],
  Assinaturas: ["Assinaturas", "Serviços recorrentes"],
  Roupa: ["Compras pessoais", "Vestuário e eletrônicos"],
  Beleza: ["Beleza e cuidados", "Pessoal"],
  Presentes: ["Lazer", "Passeios e presentes"],
  Saúde: ["Saúde", "Consultas e medicamentos"],
  "Despesas eventuais": ["Outros", "Despesas diversas"],
  Desenvolvimento: ["Educação", "Cursos e escola"],
  "Uber/transporte": ["Transporte", "Combustível e locomoção"],
  "IFood/restaurante": ["Alimentação", "Mercado e restaurantes"],
  Lazer: ["Lazer", "Passeios e presentes"],
  Aluguel: ["Moradia", "Aluguel e condomínio"],
  Contas: ["Contas domésticas", "Água, luz e internet"],
  "Não classificado": ["Outros", "Despesas diversas"],
  "Cartão de Assinaturas": ["Assinaturas", "Serviços recorrentes"],
  "Compras Grandes": ["Compras pessoais", "Vestuário e eletrônicos"],
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const RECURRENCE_FREQUENCIES = ["weekly", "biweekly", "monthly", "annual", "custom"];
const RECURRENCE_STATUSES = ["active", "paused", "ended"];
const REMINDER_TYPES = ["note", "financial"];
const REMINDER_PRIORITIES = ["low", "normal", "high"];
const REMINDER_LINK_TYPES = ["", "account", "goal", "transaction"];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function parseISO(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function isoOf(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = parseISO(value);
  if (!date) throw new Error("Data inválida.");
  date.setUTCDate(date.getUTCDate() + Number(days));
  return isoOf(date);
}

export function addMonths(value, months) {
  const date = parseISO(value);
  if (!date) throw new Error("Data inválida.");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return isoOf(date);
}

export function monthKey(value) {
  return typeof value === "string" ? value.slice(0, 7) : "";
}

export function monthStart(key) {
  if (!ISO_MONTH.test(key || "")) throw new Error("Mês inválido.");
  return `${key}-01`;
}

export function monthEnd(key) {
  const start = parseISO(monthStart(key));
  if (!start) throw new Error("Mês inválido.");
  return isoOf(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)));
}

export function moneyToCents(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valor monetário inválido.");
    return Math.round((value + Number.EPSILON) * 100);
  }
  let text = String(value ?? "").trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) throw new Error("Valor monetário inválido.");
  if (text.includes(",")) {
    if (!/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(text) && !/^-?\d+,\d{1,2}$/.test(text)) throw new Error("Valor monetário inválido.");
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Valor monetário inválido.");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error("Valor monetário inválido.");
  return Math.round((number + Number.EPSILON) * 100);
}

export function centsToMoney(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

export function sumMoney(values) {
  return centsToMoney(values.reduce((total, value) => total + moneyToCents(value), 0));
}

export function splitInstallments(total, count) {
  const totalCents = moneyToCents(total);
  const installments = Math.floor(Number(count));
  if (!(totalCents > 0) || !(installments >= 2 && installments <= 60)) {
    throw new Error("Informe um valor positivo e de 2 a 60 parcelas.");
  }
  const base = Math.floor(totalCents / installments);
  return Array.from({ length: installments }, (_, index) =>
    centsToMoney(index === installments - 1 ? totalCents - base * (installments - 1) : base)
  );
}

export function createEmptyState(profile = {}) {
  const now = new Date().toISOString();
  return {
    version: STATE_VERSION,
    meta: {
      org: PRODUCT_NAME,
      name: profile.name || "",
      email: profile.email || "",
      source: "Cadastro manual",
      defaultMonth: todayISO().slice(0, 7),
      createdAt: now,
      updatedAt: now,
    },
    accounts: [],
    categories: DEFAULT_CATEGORIES.map(([name, subcategory, type, description], index) => ({
      id: `CAT-${String(index + 1).padStart(2, "0")}`,
      name,
      subcategory,
      type,
      description,
    })),
    costCenters: [],
    transactions: [],
    transfers: [],
    budgets: [],
    reconciliations: [],
    installmentGroups: [],
    goals: [],
    shoppingLists: [],
    recurring: [],
    reminders: [],
    donors: [],
    settings: {
      methods: ["Débito", "Crédito", "PIX", "Dinheiro", "Boleto", "Transferência"],
      periodicities: ["Única", "Semanal", "Quinzenal", "Mensal", "Anual", "Personalizada"],
      types: ["Receita", "Despesa"],
      statuses: ["Previsto", "Pago", "Recebido", "Parcial", "Atrasado", "Em fatura", "Cancelado"],
      sections: ["Contas fixas", "Gastos do mês", "Cartão de crédito", "Entradas", "Investimento"],
      theme: "light",
      notifications: { dueDays: 7, budgetWarning: 80, budgetCritical: 100, goalInactivityDays: 30 },
    },
    audit: [],
  };
}

function migrateLegacyCategories(state, defaults) {
  const targets = new Map();
  const categories = [];
  const keys = new Set();
  state.categories.forEach((category) => {
    const mapped = LEGACY_CATEGORY_MAP[category.name];
    const name = mapped ? mapped[0] : category.name;
    const subcategory = mapped ? mapped[1] : category.subcategory;
    const type = category.type === "Receita" ? "Receita" : "Despesa";
    const key = `${type}:${name}:${subcategory}`;
    targets.set(`${type}:${category.name}:${category.subcategory}`, { name, subcategory, type });
    if (keys.has(key)) return;
    const preset = defaults.find((item) => item.name === name && item.subcategory === subcategory && item.type === type);
    categories.push(preset ? { ...preset, id: category.id, description: category.description || preset.description } : { ...category, name, subcategory, type });
    keys.add(key);
  });
  state.categories = categories;
  const retarget = (item) => {
    if (!item) return;
    const type = item.type === "receita" ? "Receita" : "Despesa";
    const target = targets.get(`${type}:${item.category}:${item.subcategory}`);
    if (!target) return;
    item.category = target.name;
    item.subcategory = target.subcategory;
  };
  state.transactions.forEach(retarget);
  state.recurring.forEach(retarget);
  state.installmentGroups.forEach((group) => {
    const target = targets.get(`${group.type === "receita" ? "Receita" : "Despesa"}:${group.category}:${group.subcategory}`);
    if (target) {
      group.category = target.name;
      group.subcategory = target.subcategory;
    }
  });
  state.budgets.forEach((budget) => {
    const target = [...targets.values()].find((item) => item.type === "Despesa" && item.name === budget.category);
    if (target) budget.category = target.name;
  });
  state.shoppingLists.forEach((list) => {
    (list.items || []).forEach((item) => {
      const mapped = LEGACY_CATEGORY_MAP[item.category];
      if (mapped) item.category = mapped[0];
    });
  });
}

export function normalizeState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Estado financeiro inválido.");
  const base = createEmptyState(input.meta || {});
  const state = { ...base, ...input, meta: { ...base.meta, ...(input.meta || {}) }, settings: { ...base.settings, ...(input.settings || {}) } };
  state.version = STATE_VERSION;
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(state[collection])) state[collection] = [];
  }
  migrateLegacyCategories(state, base.categories);
  state.meta.org = PRODUCT_NAME;
  if (!state.meta.name && input.meta?.org && !LEGACY_ORGS.has(input.meta.org) && input.meta.org !== PRODUCT_NAME) {
    state.meta.name = input.meta.org;
  }
  state.meta.updatedAt = new Date().toISOString();
  state.settings.theme = state.settings.theme === "dark" ? "dark" : "light";
  state.settings.statuses = [...new Set([...base.settings.statuses, ...(Array.isArray(state.settings.statuses) ? state.settings.statuses : [])])];
  state.settings.notifications = { ...base.settings.notifications, ...(state.settings.notifications || {}) };
  state.accounts.forEach((account) => {
    if (account.type !== "Cartão de crédito") return;
    account.closingDay = Number(account.closingDay) || 31;
    account.dueDay = Number(account.dueDay) || 31;
    account.limit = Number(account.limit) || 0;
  });
  const cardGroups = new Map();
  state.transactions.forEach((tx) => {
    if (!tx.section) tx.section = tx.type === "receita" ? "Entradas" : tx.groupId ? "Gastos do mês" : "Contas fixas";
    if (!Array.isArray(tx.payments)) tx.payments = [];
    tx.donorId = tx.type === "receita" ? String(tx.donorId || "") : "";
    const card = state.accounts.find((account) => account.id === tx.account && account.type === "Cartão de crédito");
    if (!card || tx.section !== "Cartão de crédito") return;
    tx.cardPurchaseId = String(tx.cardPurchaseId || (tx.groupId ? `PUR-${tx.groupId}` : `PUR-${tx.id}`));
    tx.installmentCount = Math.max(1, Math.floor(Number(tx.installmentCount) || 1));
    tx.installmentNumber = Math.max(1, Math.floor(Number(tx.installmentNumber) || 1));
    tx.donorId = "";
    if ((tx.payments || []).length && tx.payments.every((payment) => (payment.account || tx.account) === card.id)) {
      tx.payments = [];
      tx.paidDate = null;
      tx.status = "Previsto";
    }
    if (!cardGroups.has(tx.cardPurchaseId)) cardGroups.set(tx.cardPurchaseId, []);
    cardGroups.get(tx.cardPurchaseId).push(tx);
  });
  cardGroups.forEach((transactions) => {
    transactions.sort((a, b) => (a.installmentNumber - b.installmentNumber) || (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
    const count = Math.max(transactions.length, ...transactions.map((tx) => tx.installmentCount));
    const purchaseDate = transactions.reduce((earliest, tx) => tx.date < earliest ? tx.date : earliest, transactions[0].date);
    const total = sumMoney(transactions.map((tx) => tx.amount));
    const card = state.accounts.find((account) => account.id === transactions[0].account);
    const firstInvoice = parseISO(purchaseDate) ? invoiceMonthForDate(card, purchaseDate) : "";
    transactions.forEach((tx, index) => {
      const number = index + 1;
      const invoiceMonth = firstInvoice ? addMonths(`${firstInvoice}-01`, index).slice(0, 7) : "";
      tx.installmentCount = count;
      tx.installmentNumber = number;
      tx.cardPurchaseId = transactions[0].cardPurchaseId;
      tx.purchaseDate = purchaseDate;
      tx.purchaseTotal = total;
      tx.invoiceMonth = invoiceMonth;
      tx.date = number === 1 ? purchaseDate : `${invoiceMonth}-01`;
      tx.dueDate = invoiceMonth ? invoiceDueDate(card, invoiceMonth) : tx.dueDate;
      tx.status = isCancelled(tx) ? "Cancelado" : "Previsto";
    });
  });
  state.donors.forEach((donor) => {
    donor.name = String(donor.name || "").trim();
    donor.contact = String(donor.contact || "").trim();
    donor.note = String(donor.note || "").trim();
    donor.active = donor.active !== false;
  });
  state.installmentGroups.forEach((group) => {
    if (group.recordedCount == null) group.recordedCount = state.transactions.filter((tx) => tx.groupId === group.id).length;
  });
  state.goals.forEach((goal) => {
    if (!Array.isArray(goal.movements)) goal.movements = [];
    goal.initialAmount = Number(goal.initialAmount) || 0;
    if (!goal.status) goal.status = "active";
    goal.allowNegative = goal.allowNegative === true;
  });
  state.shoppingLists.forEach((list) => {
    if (!Array.isArray(list.items)) list.items = [];
    if (!Array.isArray(list.generatedTxIds)) list.generatedTxIds = [];
    if (!list.status) list.status = "active";
    list.budget = Number(list.budget) || 0;
    list.favorite = list.favorite === true;
    list.items.forEach((item) => {
      item.quantity = item.quantity == null || item.quantity === "" ? 1 : Number(item.quantity);
      item.estimatedPrice = Number(item.estimatedPrice) || 0;
      item.effectivePrice = Number(item.effectivePrice) || 0;
      item.purchased = item.purchased === true;
      if (!item.category) item.category = "Alimentação";
      if (!item.unit) item.unit = "un";
    });
  });
  state.recurring.forEach((rule) => {
    rule.type = rule.type === "receita" ? "receita" : "despesa";
    rule.amount = Number(rule.amount) || 0;
    rule.frequency = rule.frequency || "monthly";
    rule.intervalDays = rule.intervalDays == null || rule.intervalDays === "" ? null : Number(rule.intervalDays);
    rule.status = rule.status || (rule.active === false ? "paused" : "active");
    rule.active = rule.status === "active";
    rule.reviewBeforeGenerate = rule.reviewBeforeGenerate === true;
    rule.method = String(rule.method || "PIX");
    rule.section = String(rule.section || (rule.type === "receita" ? "Entradas" : "Contas fixas"));
    rule.costCenter = String(rule.costCenter || "");
    rule.note = String(rule.note || "");
    rule.donorId = rule.type === "receita" ? String(rule.donorId || "") : "";
    if (!Array.isArray(rule.occurrenceKeys)) rule.occurrenceKeys = [];
    rule.nextOccurrence = nextOccurrenceDate(rule);
  });
  state.reminders.forEach((reminder) => {
    reminder.type = reminder.type === "financial" ? "financial" : "note";
    reminder.priority = REMINDER_PRIORITIES.includes(reminder.priority) ? reminder.priority : "normal";
    reminder.completed = reminder.completed === true;
    reminder.linkType = REMINDER_LINK_TYPES.includes(reminder.linkType) ? reminder.linkType : "";
    reminder.linkId = String(reminder.linkId || "");
    reminder.note = String(reminder.note || "");
    if (reminder.remindAt) {
      const date = new Date(reminder.remindAt);
      reminder.remindAt = Number.isNaN(date.getTime()) ? reminder.remindAt : date.toISOString();
    } else reminder.remindAt = null;
    if (!reminder.completed) reminder.completedAt = null;
  });
  return state;
}

function assertUnique(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) throw new Error(`${label}: ID inválido.`);
    if (ids.has(item.id)) throw new Error(`${label}: ID duplicado ${item.id}.`);
    ids.add(item.id);
  }
}

export function validateState(input) {
  const state = normalizeState(input);
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  COLLECTIONS.forEach((name) => assertUnique(state[name], name));
  const accountIds = new Set(state.accounts.map((account) => account.id));
  const categoryKeys = new Set(state.categories.map((category) => `${category.type}:${category.name}:${category.subcategory}`));
  const expenseCategoryNames = new Set(state.categories.filter((category) => category.type === "Despesa").map((category) => category.name));
  const donorIds = new Set(state.donors.map((donor) => donor.id));
  const notifications = state.settings.notifications || {};
  const dueDays = Number(notifications.dueDays);
  const budgetWarning = Number(notifications.budgetWarning);
  const budgetCritical = Number(notifications.budgetCritical);
  const goalInactivityDays = Number(notifications.goalInactivityDays);
  check(Number.isInteger(dueDays) && dueDays >= 1 && dueDays <= 60, "Configurações: aviso de vencimento deve ser de 1 a 60 dias.");
  check(Number.isInteger(budgetWarning) && budgetWarning >= 50 && budgetWarning <= 99, "Configurações: aviso de orçamento deve ser de 50% a 99%.");
  check(Number.isInteger(budgetCritical) && budgetCritical >= 100 && budgetCritical <= 200 && budgetCritical > budgetWarning, "Configurações: limite crítico deve ser de 100% a 200% e maior que o aviso.");
  check(Number.isInteger(goalInactivityDays) && goalInactivityDays >= 1 && goalInactivityDays <= 365, "Configurações: inatividade de metas deve ser de 1 a 365 dias.");

  state.donors.forEach((donor) => {
    check(!!donor.name, `Ofertante ${donor.id}: nome é obrigatório.`);
    check(!state.donors.some((other) => other.id !== donor.id && other.name.toLocaleLowerCase("pt-BR") === donor.name.toLocaleLowerCase("pt-BR")), `Ofertante ${donor.id}: já existe um cadastro com este nome.`);
  });

  state.accounts.forEach((account) => {
    check(!!String(account.name || "").trim(), `Conta ${account.id}: nome é obrigatório.`);
    check(ACCOUNT_TYPES.includes(account.type), `Conta ${account.id}: tipo inválido.`);
    try {
      const opening = moneyToCents(account.openingBalance || 0);
      check(Number.isInteger(opening), `Conta ${account.id}: saldo inicial inválido.`);
      if (account.type === "Cartão de crédito") {
        check(moneyToCents(account.limit || 0) >= 0, `Cartão ${account.id}: limite inválido.`);
        check(Number.isInteger(Number(account.closingDay)) && account.closingDay >= 1 && account.closingDay <= 31, `Cartão ${account.id}: fechamento deve ser de 1 a 31.`);
        check(Number.isInteger(Number(account.dueDay)) && account.dueDay >= 1 && account.dueDay <= 31, `Cartão ${account.id}: vencimento deve ser de 1 a 31.`);
        account.brand = String(account.brand || "").trim();
        account.color = /^#[0-9a-f]{6}$/i.test(account.color || "") ? account.color : "#7c6a9c";
      }
    } catch (error) { errors.push(`Conta ${account.id}: ${error.message}`); }
  });

  const paymentIds = new Set();
  state.transactions.forEach((tx) => {
    check(["receita", "despesa"].includes(tx.type), `Lançamento ${tx.id}: tipo inválido.`);
    check(!!String(tx.description || "").trim(), `Lançamento ${tx.id}: descrição é obrigatória.`);
    check(parseISO(tx.date) != null, `Lançamento ${tx.id}: data inválida.`);
    check(!tx.dueDate || parseISO(tx.dueDate) != null, `Lançamento ${tx.id}: vencimento inválido.`);
    check(accountIds.has(tx.account), `Lançamento ${tx.id}: conta não encontrada.`);
    check(categoryKeys.has(`${tx.type === "receita" ? "Receita" : "Despesa"}:${tx.category}:${tx.subcategory}`), `Lançamento ${tx.id}: categoria incompatível.`);
    check(!tx.donorId || (tx.type === "receita" && donorIds.has(tx.donorId)), `Lançamento ${tx.id}: ofertante inválido.`);
    const account = accountById(state, tx.account);
    const cardPurchase = account?.type === "Cartão de crédito";
    if (cardPurchase) {
      check(tx.type === "despesa" && tx.section === "Cartão de crédito", `Lançamento ${tx.id}: compras no cartão devem ser despesas na seção Cartão de crédito.`);
      check(!(tx.payments || []).length, `Lançamento ${tx.id}: compras de cartão são liquidadas pelo pagamento da fatura, não por baixa direta.`);
      check(!!tx.cardPurchaseId && parseISO(tx.date) != null && tx.invoiceMonth === invoiceMonthForDate(account, tx.date), `Lançamento ${tx.id}: mês da fatura incompatível com a data.`);
    } else {
      check(tx.section !== "Cartão de crédito", `Lançamento ${tx.id}: a seção Cartão de crédito exige uma conta de cartão.`);
    }
    try {
      const amount = moneyToCents(tx.amount);
      check(amount > 0, `Lançamento ${tx.id}: valor deve ser positivo.`);
      const paid = (tx.payments || []).reduce((total, payment) => {
        check(!paymentIds.has(payment.id), `Baixa duplicada: ${payment.id}.`);
        paymentIds.add(payment.id);
        check(parseISO(payment.date) != null, `Baixa ${payment.id}: data inválida.`);
        check(accountIds.has(payment.account || tx.account), `Baixa ${payment.id}: conta não encontrada.`);
        check(accountById(state, payment.account || tx.account)?.type !== "Cartão de crédito", `Baixa ${payment.id}: use o pagamento da fatura para movimentar cartões.`);
        try { return total + moneyToCents(payment.amount); } catch (error) { errors.push(`Baixa ${payment.id}: ${error.message}`); return total; }
      }, 0);
      check(paid <= amount, `Lançamento ${tx.id}: baixas superam o valor total.`);
    } catch (error) { errors.push(`Lançamento ${tx.id}: ${error.message}`); }
  });

  state.transfers.forEach((transfer) => {
    check(accountIds.has(transfer.fromAccount) && accountIds.has(transfer.toAccount), `Transferência ${transfer.id}: conta inválida.`);
    check(transfer.fromAccount !== transfer.toAccount, `Transferência ${transfer.id}: origem e destino devem ser diferentes.`);
    check(parseISO(transfer.date) != null, `Transferência ${transfer.id}: data inválida.`);
    const source = accountById(state, transfer.fromAccount);
    const destination = accountById(state, transfer.toAccount);
    check(destination?.type !== "Cartão de crédito" || ISO_MONTH.test(transfer.invoiceMonth || ""), `Transferência ${transfer.id}: informe o mês da fatura paga.`);
    check(source?.type !== "Cartão de crédito", `Transferência ${transfer.id}: um cartão não pode ser origem de outra transferência.`);
    check(destination?.type === "Cartão de crédito" || !transfer.invoiceMonth, `Transferência ${transfer.id}: mês de fatura só é válido para cartão de crédito.`);
    try {
      check(moneyToCents(transfer.amount) > 0, `Transferência ${transfer.id}: valor deve ser positivo.`);
      check(moneyToCents(transfer.fee || 0) >= 0, `Transferência ${transfer.id}: taxa inválida.`);
    } catch (error) { errors.push(`Transferência ${transfer.id}: ${error.message}`); }
  });

  const cardPurchaseGroups = new Map();
  state.transactions.forEach((tx) => {
    if (accountById(state, tx.account)?.type !== "Cartão de crédito") return;
    if (!cardPurchaseGroups.has(tx.cardPurchaseId)) cardPurchaseGroups.set(tx.cardPurchaseId, []);
    cardPurchaseGroups.get(tx.cardPurchaseId).push(tx);
  });
  cardPurchaseGroups.forEach((transactions, purchaseId) => {
    const count = transactions[0].installmentCount;
    check(transactions.length === count, `Compra ${purchaseId}: quantidade de parcelas incompleta.`);
    check(Number.isInteger(count) && count >= 1 && count <= 60, `Compra ${purchaseId}: quantidade de parcelas inválida.`);
    check(transactions.every((tx) => tx.account === transactions[0].account && tx.purchaseDate === transactions[0].purchaseDate), `Compra ${purchaseId}: cartão ou data da compra divergentes.`);
    check(sumMoney(transactions.map((tx) => tx.amount)) === transactions[0].purchaseTotal, `Compra ${purchaseId}: soma das parcelas não confere com o total.`);
    check(transactions.every((tx) => tx.installmentNumber >= 1 && tx.installmentNumber <= count), `Compra ${purchaseId}: número de parcela inválido.`);
    check(new Set(transactions.map((tx) => tx.installmentNumber)).size === transactions.length, `Compra ${purchaseId}: parcela duplicada.`);
    check(transactions.every((tx) => isCancelled(tx)) || transactions.every((tx) => !isCancelled(tx)), `Compra ${purchaseId}: cancele todas as parcelas ou nenhuma.`);
    transactions.forEach((tx) => {
      const invoice = cardInvoice(state, tx.account, tx.invoiceMonth);
      check(invoice.paid <= invoice.total + 0.004, `Compra ${purchaseId}: pagamento da fatura ${tx.invoiceMonth} excede o total.`);
    });
  });
  state.accounts.filter((account) => account.type === "Cartão de crédito").forEach((card) => {
    if (Number(card.limit) <= 0) return;
    const summary = cardSummary(state, card.id);
    check(summary.used <= Number(card.limit) + 0.004, `Cartão ${card.id}: limite excedido em ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.used - Number(card.limit))}.`);
  });

  const recurringKeys = new Set();
  const recurringRules = new Map(state.recurring.map((rule) => [rule.id, rule]));
  state.recurring.forEach((rule) => {
    check(!!String(rule.description || "").trim(), `Recorrência ${rule.id}: descrição é obrigatória.`);
    check(["receita", "despesa"].includes(rule.type), `Recorrência ${rule.id}: tipo inválido.`);
    check(accountIds.has(rule.account), `Recorrência ${rule.id}: conta não encontrada.`);
    check(categoryKeys.has(`${rule.type === "receita" ? "Receita" : "Despesa"}:${rule.category}:${rule.subcategory}`), `Recorrência ${rule.id}: categoria incompatível.`);
    check(!rule.donorId || (rule.type === "receita" && donorIds.has(rule.donorId)), `Recorrência ${rule.id}: ofertante inválido.`);
    try { check(moneyToCents(rule.amount) > 0, `Recorrência ${rule.id}: valor deve ser positivo.`); }
    catch (error) { errors.push(`Recorrência ${rule.id}: ${error.message}`); }
    check(parseISO(rule.startDate) != null, `Recorrência ${rule.id}: data inicial inválida.`);
    check(!rule.endDate || (parseISO(rule.endDate) != null && rule.endDate >= rule.startDate), `Recorrência ${rule.id}: data final inválida.`);
    check(RECURRENCE_FREQUENCIES.includes(rule.frequency), `Recorrência ${rule.id}: frequência inválida.`);
    check(RECURRENCE_STATUSES.includes(rule.status), `Recorrência ${rule.id}: status inválido.`);
    if (rule.frequency === "custom") check(Number.isInteger(rule.intervalDays) && rule.intervalDays > 0, `Recorrência ${rule.id}: intervalo inválido.`);
    (rule.occurrenceKeys || []).forEach((key) => {
      const date = String(key).startsWith(`${rule.id}:`) ? String(key).slice(rule.id.length + 1) : "";
      check(!!date && parseISO(date) != null, `Recorrência ${rule.id}: ocorrência inválida ${key}.`);
      check(!recurringKeys.has(key), `Recorrência ${rule.id}: ocorrência duplicada ${key}.`);
      recurringKeys.add(key);
    });
  });
  const recurringTransactions = new Set();
  state.transactions.forEach((tx) => {
    if (!tx.recurrenceId && !tx.occurrenceKey) return;
    const rule = recurringRules.get(tx.recurrenceId);
    check(!!rule, `Lançamento ${tx.id}: recorrência não encontrada.`);
    check(parseISO(tx.occurrenceDate) != null, `Lançamento ${tx.id}: data da ocorrência inválida.`);
    const key = `${tx.recurrenceId}:${tx.occurrenceDate}`;
    check(tx.occurrenceKey === key, `Lançamento ${tx.id}: chave da ocorrência inválida.`);
    check(recurringKeys.has(key), `Lançamento ${tx.id}: ocorrência de recorrência duplicada ou inválida.`);
    check(!recurringTransactions.has(key), `Lançamento ${tx.id}: ocorrência de recorrência duplicada.`);
    recurringTransactions.add(key);
  });
  recurringKeys.forEach((key) => {
    check(recurringTransactions.has(key), `Recorrência: ocorrência sem lançamento ${key}.`);
  });

  const goalIds = new Set(state.goals.map((goal) => goal.id));
  const transactionIds = new Set(state.transactions.map((tx) => tx.id));
  state.reminders.forEach((reminder) => {
    check(!!String(reminder.title || "").trim(), `Lembrete ${reminder.id}: título é obrigatório.`);
    check(REMINDER_TYPES.includes(reminder.type), `Lembrete ${reminder.id}: tipo inválido.`);
    check(REMINDER_PRIORITIES.includes(reminder.priority), `Lembrete ${reminder.id}: prioridade inválida.`);
    check(!reminder.remindAt || !Number.isNaN(new Date(reminder.remindAt).getTime()), `Lembrete ${reminder.id}: data e hora inválidas.`);
    check(!reminder.completedAt || !Number.isNaN(new Date(reminder.completedAt).getTime()), `Lembrete ${reminder.id}: data de conclusão inválida.`);
    check(REMINDER_LINK_TYPES.includes(reminder.linkType), `Lembrete ${reminder.id}: vínculo inválido.`);
    check(reminder.linkType ? !!reminder.linkId : !reminder.linkId, `Lembrete ${reminder.id}: informe o item vinculado.`);
    if (reminder.linkType === "account") check(accountIds.has(reminder.linkId), `Lembrete ${reminder.id}: conta vinculada não encontrada.`);
    if (reminder.linkType === "goal") check(goalIds.has(reminder.linkId), `Lembrete ${reminder.id}: meta vinculada não encontrada.`);
    if (reminder.linkType === "transaction") check(transactionIds.has(reminder.linkId), `Lembrete ${reminder.id}: movimentação vinculada não encontrada.`);
  });

  const shoppingItemIds = new Set();
  const generatedShoppingTxIds = new Set();
  state.shoppingLists.forEach((list) => {
    check(!!String(list.name || "").trim(), `Lista ${list.id}: nome é obrigatório.`);
    check(["active", "completed", "archived"].includes(list.status), `Lista ${list.id}: status inválido.`);
    try {
      check(moneyToCents(list.budget || 0) >= 0, `Lista ${list.id}: orçamento inválido.`);
    } catch (error) { errors.push(`Lista ${list.id}: ${error.message}`); }
    (list.items || []).forEach((item) => {
      check(!shoppingItemIds.has(item.id), `Item de compra duplicado: ${item.id}.`);
      shoppingItemIds.add(item.id);
      check(!!String(item.name || "").trim(), `Item ${item.id}: nome é obrigatório.`);
      check(!!String(item.unit || "").trim(), `Item ${item.id}: unidade é obrigatória.`);
      check(expenseCategoryNames.has(item.category), `Item ${item.id}: categoria inválida.`);
      try {
        check(Number.isFinite(item.quantity) && item.quantity > 0, `Item ${item.id}: quantidade deve ser positiva.`);
        check(moneyToCents(item.estimatedPrice || 0) >= 0, `Item ${item.id}: preço estimado inválido.`);
        check(moneyToCents(item.effectivePrice || 0) >= 0, `Item ${item.id}: preço efetivo inválido.`);
      } catch (error) { errors.push(`Item ${item.id}: ${error.message}`); }
    });
    (list.generatedTxIds || []).forEach((txId) => {
      const tx = state.transactions.find((item) => item.id === txId);
      check(!generatedShoppingTxIds.has(txId), `Lista ${list.id}: lançamento de compra duplicado ${txId}.`);
      generatedShoppingTxIds.add(txId);
      check(!!tx && tx.shoppingListId === list.id, `Lista ${list.id}: lançamento vinculado não encontrado.`);
    });
    check(!list.generatedTxIds?.length || list.status !== "active", `Lista ${list.id}: conclua a lista após gerar a despesa.`);
  });
  state.transactions.forEach((tx) => {
    if (!tx.shoppingListId) return;
    const list = state.shoppingLists.find((item) => item.id === tx.shoppingListId);
    check(!!list && list.generatedTxIds?.includes(tx.id), `Lançamento ${tx.id}: vínculo de compra inválido.`);
  });

  const linkedGoalTransfers = new Set();
  state.goals.forEach((goal) => {
    check(!!String(goal.name || "").trim(), `Meta ${goal.id}: nome é obrigatório.`);
    check(accountIds.has(goal.account), `Meta ${goal.id}: conta de investimento não encontrada.`);
    const account = state.accounts.find((item) => item.id === goal.account);
    check(account && account.type === "Investimento", `Meta ${goal.id}: use uma conta de investimento.`);
    check(parseISO(goal.startDate) != null, `Meta ${goal.id}: data de início inválida.`);
    check(!goal.targetDate || (parseISO(goal.targetDate) != null && goal.targetDate >= goal.startDate), `Meta ${goal.id}: data prevista inválida.`);
    check(["active", "paused", "concluded", "cancelled"].includes(goal.status), `Meta ${goal.id}: status inválido.`);
    try {
      check(moneyToCents(goal.target) > 0, `Meta ${goal.id}: valor desejado deve ser positivo.`);
      check(moneyToCents(goal.initialAmount || 0) >= 0, `Meta ${goal.id}: valor inicial inválido.`);
    } catch (error) { errors.push(`Meta ${goal.id}: ${error.message}`); }
    const validateTransfer = (transferId, amount, date, type, accountId) => {
      if (!transferId) return;
      const transfer = state.transfers.find((item) => item.id === transferId);
      check(!!transfer, `Meta ${goal.id}: transferência ${transferId} não encontrada.`);
      check(!linkedGoalTransfers.has(transferId), `Meta ${goal.id}: transferência ${transferId} duplicada.`);
      linkedGoalTransfers.add(transferId);
      if (!transfer) return;
      check(moneyToCents(transfer.amount) === moneyToCents(amount), `Meta ${goal.id}: valor da transferência não confere.`);
      check(transfer.date === date, `Meta ${goal.id}: data da transferência não confere.`);
      check(type === "deposito" ? transfer.fromAccount === accountId && transfer.toAccount === goal.account : transfer.fromAccount === goal.account && transfer.toAccount === accountId, `Meta ${goal.id}: contas da transferência não conferem.`);
    };
    const initialAccount = state.accounts.find((item) => item.id === goal.initialAccount);
    if (goal.initialAccount) check(!!initialAccount && !["Cartão de crédito", "Investimento"].includes(initialAccount.type), `Meta ${goal.id}: conta do valor inicial inválida.`);
    if (goal.initialTransferId) validateTransfer(goal.initialTransferId, goal.initialAmount, goal.startDate, "deposito", goal.initialAccount);
    const movementIds = new Set();
    (goal.movements || []).forEach((movement) => {
      check(!movementIds.has(movement.id), `Meta ${goal.id}: movimento duplicado ${movement.id}.`);
      movementIds.add(movement.id);
      check(["deposito", "retirada"].includes(movement.type), `Meta ${goal.id}: tipo de movimento inválido.`);
      check(parseISO(movement.date) != null && movement.date >= goal.startDate, `Meta ${goal.id}: data de movimento inválida.`);
      try { check(moneyToCents(movement.amount) > 0, `Meta ${goal.id}: valor do movimento deve ser positivo.`); }
      catch (error) { errors.push(`Meta ${goal.id}: ${error.message}`); }
      if (movement.counterpartAccount) {
        const counterpart = state.accounts.find((item) => item.id === movement.counterpartAccount);
        check(!!counterpart && !["Cartão de crédito", "Investimento"].includes(counterpart.type), `Meta ${goal.id}: conta do movimento inválida.`);
      }
      if (movement.transferId) validateTransfer(movement.transferId, movement.amount, movement.date, movement.type, movement.counterpartAccount);
    });
    const reversedIds = new Set();
    (goal.movements || []).forEach((movement) => {
      if (!movement.reversalOf) return;
      const original = goal.movements.find((item) => item.id === movement.reversalOf);
      check(!!original && !original.reversalOf, `Meta ${goal.id}: movimento de origem do estorno inválido.`);
      check(!reversedIds.has(movement.reversalOf), `Meta ${goal.id}: movimento estornado mais de uma vez.`);
      reversedIds.add(movement.reversalOf);
    });
    const balance = goalBalance(goal);
    check(balance >= 0 || goal.allowNegative === true, `Meta ${goal.id}: retirada deixaria o saldo negativo.`);
  });

  if (errors.length) throw new Error(errors.join(" "));
  state.settings.notifications = {
    dueDays: Number(state.settings.notifications.dueDays),
    budgetWarning: Number(state.settings.notifications.budgetWarning),
    budgetCritical: Number(state.settings.notifications.budgetCritical),
    goalInactivityDays: Number(state.settings.notifications.goalInactivityDays),
  };
  return state;
}

export function isCancelled(tx) {
  return !!(tx && (tx.cancelled || tx.status === "Cancelado"));
}

export function paidTotal(tx) {
  return sumMoney((tx?.payments || []).map((payment) => payment.amount));
}

export function remaining(tx) {
  return Math.max(0, centsToMoney(moneyToCents(tx?.amount || 0) - moneyToCents(paidTotal(tx))));
}

export function isCashAccount(account) {
  return !!account && !["Cartão de crédito", "Cartão", "Investimento"].includes(account.type);
}

export function accountById(state, id) {
  return state.accounts.find((account) => account.id === id) || null;
}

export function accountBalance(state, accountId, until = todayISO()) {
  const account = accountById(state, accountId);
  if (!account) return 0;
  const values = [account.openingBalance || 0];
  state.transactions.forEach((tx) => {
    if (isCancelled(tx)) return;
    if (account.type === "Cartão de crédito" && tx.account === accountId && tx.section === "Cartão de crédito" && !(tx.payments || []).length && tx.date <= until) {
      values.push(-tx.amount);
    }
    (tx.payments || []).forEach((payment) => {
      if ((payment.account || tx.account) !== accountId || payment.date > until) return;
      values.push(tx.type === "receita" ? payment.amount : -payment.amount);
    });
  });
  state.transfers.forEach((transfer) => {
    if (transfer.date > until) return;
    if (transfer.fromAccount === accountId) values.push(-transfer.amount);
    if (transfer.toAccount === accountId) values.push(transfer.amount);
  });
  return sumMoney(values);
}

export function consolidatedBalance(state, until = todayISO()) {
  return sumMoney(state.accounts.filter((account) => isCashAccount(account)).map((account) => accountBalance(state, account.id, until)));
}

export function investmentBalance(state, until = todayISO()) {
  return sumMoney(state.accounts.filter((account) => account.type === "Investimento").map((account) => accountBalance(state, account.id, until)));
}

export function paymentsInMonth(state, key, options = {}) {
  const result = [];
  state.transactions.forEach((tx) => {
    if (isCancelled(tx) || (options.type && tx.type !== options.type)) return;
    (tx.payments || []).forEach((payment) => {
      if (monthKey(payment.date) !== key) return;
      if (options.cashOnly && !isCashAccount(accountById(state, payment.account || tx.account))) return;
      result.push({ tx, payment });
    });
  });
  return result;
}

export function monthStats(state, key) {
  const payments = paymentsInMonth(state, key, { cashOnly: true });
  const received = sumMoney(payments.filter(({ tx }) => tx.type === "receita").map(({ payment }) => payment.amount));
  const paid = sumMoney(payments.filter(({ tx }) => tx.type === "despesa").map(({ payment }) => payment.amount));
  let incoming = 0;
  let outgoing = 0;
  let countReceber = 0;
  let countPagar = 0;
  state.transactions.forEach((tx) => {
    if (isCancelled(tx) || !tx.dueDate || monthKey(tx.dueDate) !== key || !isCashAccount(accountById(state, tx.account))) return;
    const open = remaining(tx);
    if (open <= 0) return;
    if (tx.type === "receita") { incoming += open; countReceber += 1; }
    else { outgoing += open; countPagar += 1; }
  });
  const startBalance = consolidatedBalance(state, addDays(monthStart(key), -1));
  const finalBalance = centsToMoney(moneyToCents(startBalance) + moneyToCents(received) - moneyToCents(paid));
  return {
    key,
    receitasRecebidas: received,
    despesasPagas: paid,
    resultado: centsToMoney(moneyToCents(received) - moneyToCents(paid)),
    entradasPrevistas: centsToMoney(Math.round(incoming * 100)),
    saidasPrevistas: centsToMoney(Math.round(outgoing * 100)),
    countReceber,
    countPagar,
    saldoInicial: startBalance,
    saldoFinal: finalBalance,
    saldoProjetado: centsToMoney(moneyToCents(finalBalance) + moneyToCents(incoming) - moneyToCents(outgoing)),
  };
}

export function monthPlan(state, key) {
  const transactions = state.transactions.filter((tx) => !isCancelled(tx) && monthKey(tx.date) === key);
  const receitas = sumMoney(transactions.filter((tx) => tx.type === "receita").map((tx) => tx.amount));
  const despesas = sumMoney(transactions.filter((tx) => tx.type === "despesa").map((tx) => tx.amount));
  const fixas = sumMoney(transactions.filter((tx) => tx.type === "despesa" && tx.section === "Contas fixas").map((tx) => tx.amount));
  const cartao = sumMoney(transactions.filter((tx) => tx.type === "despesa" && tx.section === "Cartão de crédito").map((tx) => tx.amount));
  const investimentos = sumMoney(state.transfers.filter((transfer) => monthKey(transfer.date) === key && accountById(state, transfer.toAccount)?.type === "Investimento").map((transfer) => transfer.amount));
  return {
    receitas,
    despesas,
    saldo: centsToMoney(moneyToCents(receitas) - moneyToCents(despesas)),
    fixas,
    variaveis: centsToMoney(moneyToCents(despesas) - moneyToCents(fixas) - moneyToCents(cartao)),
    cartao,
    investimentos,
  };
}

export function goalBalance(goal) {
  const initial = moneyToCents(goal.initialAmount || 0);
  const movements = (goal.movements || []).reduce((total, movement) => {
    const amount = moneyToCents(movement.amount || 0);
    return total + (movement.type === "retirada" ? -amount : amount);
  }, initial);
  return centsToMoney(movements);
}

export function shoppingTotals(list) {
  const items = list.items || [];
  const lineCents = (item, field) => Math.round(moneyToCents(item.quantity || 0) * moneyToCents(item[field] || 0) / 100);
  const estimated = items.reduce((total, item) => total + lineCents(item, "estimatedPrice"), 0);
  const effective = items.filter((item) => item.purchased).reduce((total, item) => total + lineCents(item, "effectivePrice"), 0);
  return {
    estimated: centsToMoney(estimated),
    effective: centsToMoney(effective),
    purchased: items.filter((item) => item.purchased).length,
    pending: items.filter((item) => !item.purchased).length,
  };
}

export function invoiceMonthForDate(card, date) {
  const parsed = parseISO(date);
  if (!parsed) throw new Error("Data da compra inválida.");
  const closingDay = Math.min(31, Number(card.closingDay) || 31);
  const current = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
  return parsed.getUTCDate() <= closingDay ? current : addMonths(`${current}-01`, 1).slice(0, 7);
}

export function invoiceDueDate(card, invoiceMonth) {
  const closingDay = Math.min(31, Number(card.closingDay) || 31);
  const dueDay = Math.min(31, Number(card.dueDay) || closingDay);
  const month = invoiceMonth;
  const last = Number(monthEnd(month).slice(8, 10));
  const due = `${month}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
  return dueDay <= closingDay ? addMonths(`${month}-01`, 1).slice(0, 8) + String(Math.min(dueDay, Number(monthEnd(addMonths(`${month}-01`, 1).slice(0, 7)).slice(8, 10)))).padStart(2, "0") : due;
}

export function cardInvoice(state, cardId, key) {
  const card = accountById(state, cardId);
  if (!card || card.type !== "Cartão de crédito") throw new Error("Cartão não encontrado.");
  const purchases = state.transactions.filter((tx) => !isCancelled(tx) && tx.account === cardId && tx.section === "Cartão de crédito" && (tx.invoiceMonth || invoiceMonthForDate(card, tx.date)) === key);
  const total = sumMoney(purchases.map((tx) => tx.amount));
  const allocated = state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth === key);
  const paid = sumMoney(allocated.map((transfer) => transfer.amount));
  return {
    cardId,
    month: key,
    closingDate: `${key}-${String(Math.min(Number(card.closingDay) || 31, Number(monthEnd(key).slice(8, 10)))).padStart(2, "0")}`,
    dueDate: invoiceDueDate(card, key),
    total,
    paid,
    balance: Math.max(0, centsToMoney(moneyToCents(total) - moneyToCents(paid))),
    status: paid + 0.004 >= total ? "Paga" : paid > 0 ? "Parcial" : key < todayISO().slice(0, 7) ? "Vencida" : "Aberta",
    purchaseCount: purchases.length,
  };
}

export function cardSummary(state, cardId) {
  const card = accountById(state, cardId);
  const purchases = sumMoney(state.transactions.filter((tx) => !isCancelled(tx) && tx.account === cardId && tx.section === "Cartão de crédito").map((tx) => tx.amount));
  const paid = sumMoney(state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth).map((transfer) => transfer.amount));
  const used = Math.max(0, centsToMoney(moneyToCents(purchases) - moneyToCents(paid)));
  const limit = Number(card?.limit) || 0;
  return { total: limit, used, available: Math.max(0, centsToMoney(moneyToCents(limit) - moneyToCents(used))) };
}

function nextPurchaseId(transactions) {
  const max = transactions.reduce((highest, tx) => {
    const match = String(tx.cardPurchaseId || "").match(/^PUR-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `PUR-${String(max + 1).padStart(4, "0")}`;
}

function nextTransferId(transfers) {
  const max = transfers.reduce((highest, transfer) => {
    const match = String(transfer.id || "").match(/(\d+)\s*$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `TR-${String(max + 1).padStart(3, "0")}`;
}

function cardPurchaseRecords(state, data, purchaseId) {
  const card = accountById(state, data.account);
  if (!card || card.type !== "Cartão de crédito") throw new Error("Selecione um cartão de crédito.");
  const description = String(data.description || "").trim();
  if (!description) throw new Error("Informe a descrição da compra.");
  if (!parseISO(data.date)) throw new Error("Informe a data da compra.");
  const total = centsToMoney(moneyToCents(data.total ?? data.amount));
  if (total <= 0) throw new Error("Informe o valor total da compra.");
  const count = Math.floor(Number(data.installments ?? data.count ?? 1));
  if (!(count >= 1 && count <= 60)) throw new Error("Informe de 1 a 60 parcelas.");
  const category = state.categories.find((item) => item.type === "Despesa" && item.name === data.category && item.subcategory === data.subcategory);
  if (!category) throw new Error("Selecione uma categoria de despesa válida.");
  const amounts = count === 1 ? [total] : splitInstallments(total, count);
  const firstInvoice = invoiceMonthForDate(card, data.date);
  const existing = state.transactions.filter((tx) => tx.cardPurchaseId === purchaseId).sort((a, b) => a.installmentNumber - b.installmentNumber);
  const created = [];
  const now = new Date().toISOString();
  return amounts.map((amount, index) => {
    const number = index + 1;
    const invoiceMonth = addMonths(`${firstInvoice}-01`, index).slice(0, 7);
    const previous = existing.find((tx) => tx.installmentNumber === number);
    const record = {
      id: previous?.id || nextTransactionId([...state.transactions, ...created]),
      type: "despesa",
      description: count === 1 ? description : `${description} (${number}/${count})`,
      category: category.name,
      subcategory: category.subcategory,
      section: "Cartão de crédito",
      account: card.id,
      costCenter: String(data.costCenter || "").trim(),
      amount,
      date: number === 1 ? data.date : `${invoiceMonth}-01`,
      dueDate: invoiceDueDate(card, invoiceMonth),
      invoiceMonth,
      cardPurchaseId: purchaseId,
      installmentCount: count,
      installmentNumber: number,
      purchaseDate: data.date,
      purchaseTotal: total,
      paidDate: null,
      status: "Previsto",
      method: "Crédito",
      note: String(data.note || "").trim(),
      document: String(data.document || "").trim(),
      payments: [],
      groupId: count > 1 ? purchaseId : null,
      sourceRef: `${card.name} · compra ${purchaseId}`,
      donorId: "",
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      cancelled: false,
    };
    created.push(record);
    return record;
  });
}

export function saveCardPurchase(input, data, purchaseId = null) {
  const state = validateState(input);
  const id = purchaseId || nextPurchaseId(state.transactions);
  const existing = state.transactions.filter((tx) => tx.cardPurchaseId === id);
  if (purchaseId && !existing.length) throw new Error("Compra não encontrada.");
  if (existing.some(isCancelled)) throw new Error("Uma compra cancelada não pode ser editada.");
  state.transactions = state.transactions.filter((tx) => tx.cardPurchaseId !== id);
  const transactions = cardPurchaseRecords(state, data, id);
  state.transactions.unshift(...transactions);
  return { state: validateState(state), purchaseId: id, transactions, created: !purchaseId };
}

export function cancelCardPurchase(input, purchaseId, reason) {
  const state = validateState(input);
  const transactions = state.transactions.filter((tx) => tx.cardPurchaseId === purchaseId);
  if (!transactions.length) throw new Error("Compra não encontrada.");
  if (transactions.some(isCancelled)) throw new Error("A compra já está cancelada.");
  const motive = String(reason || "").trim();
  if (!motive) throw new Error("Informe o motivo do cancelamento.");
  const paid = new Set(transactions.filter((tx) => state.transfers.some((transfer) => transfer.toAccount === tx.account && transfer.invoiceMonth === tx.invoiceMonth)).map((tx) => tx.invoiceMonth));
  if (paid.size) throw new Error("Estorne os pagamentos das faturas desta compra antes de cancelá-la.");
  const now = new Date().toISOString();
  transactions.forEach((tx) => {
    tx.cancelled = true;
    tx.status = "Cancelado";
    tx.cancelledAt = now;
    tx.cancelReason = motive;
    tx.updatedAt = now;
  });
  return { state: validateState(state), transactions };
}

export function payCardInvoice(input, cardId, invoiceMonth, data) {
  const state = validateState(input);
  if (!ISO_MONTH.test(invoiceMonth || "") || !parseISO(`${invoiceMonth}-01`)) throw new Error("Mês da fatura inválido.");
  const invoice = cardInvoice(state, cardId, invoiceMonth);
  const amount = centsToMoney(moneyToCents(data.amount));
  if (amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (amount > invoice.balance + 0.004) throw new Error(`O valor excede o saldo da fatura (${invoice.balance.toFixed(2).replace(".", ",")}).`);
  if (!parseISO(data.date)) throw new Error("Informe a data do pagamento.");
  const source = accountById(state, data.fromAccount);
  if (!source || source.type === "Cartão de crédito") throw new Error("Selecione uma conta de pagamento válida.");
  const transfer = {
    id: nextTransferId(state.transfers),
    date: data.date,
    fromAccount: source.id,
    toAccount: cardId,
    invoiceMonth,
    amount,
    fee: 0,
    note: String(data.note || `Pagamento da fatura ${invoiceMonth}`).trim(),
  };
  state.transfers.unshift(transfer);
  return { state: validateState(state), transfer };
}

export function reverseInvoicePayment(input, transferId) {
  const state = validateState(input);
  const transfer = state.transfers.find((item) => item.id === transferId);
  if (!transfer || accountById(state, transfer.toAccount)?.type !== "Cartão de crédito" || !transfer.invoiceMonth) {
    throw new Error("Pagamento de fatura não encontrado.");
  }
  state.transfers = state.transfers.filter((item) => item.id !== transferId);
  state.transactions = state.transactions.filter((tx) => tx.groupId !== `TRF:${transferId}`);
  return { state: validateState(state), transfer };
}

export function occurrenceDate(rule, index) {
  const start = rule.startDate;
  if (rule.frequency === "weekly") return addDays(start, index * 7);
  if (rule.frequency === "biweekly") return addDays(start, index * 14);
  if (rule.frequency === "monthly") return addMonths(start, index);
  if (rule.frequency === "annual") return addMonths(start, index * 12);
  if (rule.frequency === "custom") return addDays(start, index * Number(rule.intervalDays));
  return index === 0 ? start : null;
}

export function nextOccurrenceDate(rule, from = todayISO()) {
  if (rule.active === false || rule.status === "paused" || rule.status === "ended") return null;
  const start = parseISO(rule.startDate);
  const target = parseISO(from);
  if (!start || !target) return null;
  const existing = new Set(rule.occurrenceKeys || []);
  const days = Math.floor((target - start) / 86400000);
  let index = 0;
  if (rule.frequency === "weekly") index = Math.floor(days / 7);
  else if (rule.frequency === "biweekly") index = Math.floor(days / 14);
  else if (rule.frequency === "custom" && Number(rule.intervalDays) > 0) index = Math.floor(days / Number(rule.intervalDays));
  else if (rule.frequency === "monthly") index = (target.getUTCFullYear() - start.getUTCFullYear()) * 12 + target.getUTCMonth() - start.getUTCMonth();
  else if (rule.frequency === "annual") index = target.getUTCFullYear() - start.getUTCFullYear();
  index = Math.max(0, index - 1);
  for (let cursor = index; cursor < index + 1000; cursor += 1) {
    const date = occurrenceDate(rule, cursor);
    if (!date || (rule.endDate && date > rule.endDate)) return null;
    if (date < from) continue;
    if (!existing.has(`${rule.id}:${date}`)) return date;
  }
  return null;
}

export function missingOccurrences(rule, through = todayISO()) {
  if (rule.active === false || rule.status === "paused" || rule.status === "ended") return [];
  if (!parseISO(through)) throw new Error("Data limite inválida.");
  const existing = new Set(rule.occurrenceKeys || []);
  const dates = [];
  for (let index = 0; index < 1000; index += 1) {
    const date = occurrenceDate(rule, index);
    if (!date || date > through) break;
    if (rule.endDate && date > rule.endDate) break;
    const key = `${rule.id}:${date}`;
    if (!existing.has(key)) dates.push({ date, key });
  }
  return dates;
}

function nextTransactionId(transactions) {
  const max = transactions.reduce((highest, tx) => {
    const match = String(tx.id || "").match(/(\d+)\s*$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `LAN-${String(max + 1).padStart(4, "0")}`;
}

export function generateRecurringOccurrences(input, ruleId, through = todayISO(), selectedKeys = null) {
  const state = validateState(JSON.parse(JSON.stringify(input)));
  const rule = state.recurring.find((item) => item.id === ruleId);
  if (!rule) throw new Error("Recorrência não encontrada.");
  if (rule.status !== "active" || rule.active === false) throw new Error("Retome a recorrência antes de gerar ocorrências.");
  const pending = missingOccurrences(rule, through);
  let occurrences = pending;
  if (rule.reviewBeforeGenerate) {
    if (!Array.isArray(selectedKeys)) throw new Error("Revise as ocorrências antes de confirmar.");
    const allowed = new Set(pending.map((item) => item.key));
    const selected = new Set();
    selectedKeys.forEach((key) => {
      if (!allowed.has(key)) throw new Error("Uma ocorrência selecionada não está mais pendente. Atualize a revisão.");
      if (selected.has(key)) throw new Error("Ocorrência selecionada mais de uma vez.");
      selected.add(key);
    });
    if (!selected.size) throw new Error("Selecione ao menos uma ocorrência para gerar.");
    occurrences = pending.filter((item) => selected.has(item.key));
  }
  const created = [];
  const now = new Date().toISOString();
  occurrences.forEach((occurrence) => {
    const tx = {
      id: nextTransactionId([...state.transactions, ...created]),
      type: rule.type,
      description: rule.description,
      category: rule.category,
      subcategory: rule.subcategory,
      section: rule.section,
      account: rule.account,
      costCenter: rule.costCenter,
      amount: rule.amount,
      date: occurrence.date,
      dueDate: occurrence.date,
      paidDate: null,
      status: "Previsto",
      method: rule.method,
      note: rule.note,
      document: "",
      payments: [],
      recurrenceId: rule.id,
      occurrenceDate: occurrence.date,
      occurrenceKey: occurrence.key,
      donorId: rule.donorId || "",
      createdAt: now,
      updatedAt: now,
      cancelled: false,
    };
    created.push(tx);
    rule.occurrenceKeys.push(occurrence.key);
  });
  if (created.length) {
    state.transactions.unshift(...created);
    rule.lastGeneratedAt = now;
    rule.updatedAt = now;
    rule.nextOccurrence = nextOccurrenceDate(rule);
    state.audit.unshift({
      id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      ts: now,
      action: "Ocorrências recorrentes geradas",
      entity: "Recorrência",
      ref: rule.id,
      detail: `${created.length} lançamento(s) previsto(s) até ${through}.`,
    });
  }
  return { state: validateState(state), created };
}

export function annualSummary(state, year) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2200) throw new Error("Ano inválido.");
  let accumulated = 0;
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${numericYear}-${String(index + 1).padStart(2, "0")}`;
    const stats = monthStats(state, key);
    const plan = monthPlan(state, key);
    const previous = index === 0 ? null : monthPlan(state, `${numericYear}-${String(index).padStart(2, "0")}`);
    const growth = previous && previous.despesas > 0 ? (plan.despesas - previous.despesas) / previous.despesas : null;
    accumulated = centsToMoney(moneyToCents(accumulated) + moneyToCents(stats.resultado));
    const goals = sumMoney(state.goals.filter((goal) => monthKey(goal.startDate) === key).map((goal) => goal.target));
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(parseISO(`${key}-01`)),
      receitas: plan.receitas,
      despesas: plan.despesas,
      aReceber: stats.entradasPrevistas,
      aPagar: stats.saidasPrevistas,
      recebido: stats.receitasRecebidas,
      pago: stats.despesasPagas,
      saldo: stats.resultado,
      acumulado: accumulated,
      crescimento: growth,
      investimentos: plan.investimentos,
      metas: goals,
      ofertantes: state.transactions.filter((tx) => !isCancelled(tx) && tx.type === "receita" && tx.donorId && monthKey(tx.date) === key).map((tx) => ({ id: tx.donorId, name: state.donors.find((donor) => donor.id === tx.donorId)?.name || "Ofertante" })),
      movimentado: state.transactions.some((tx) => !isCancelled(tx) && (monthKey(tx.date) === key || (tx.payments || []).some((payment) => monthKey(payment.date) === key))) || state.transfers.some((transfer) => monthKey(transfer.date) === key),
    };
  });
}

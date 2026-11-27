/* =========================================================
   FINANCE MASTER — store, cálculos e regras de negócio
   ========================================================= */
(function () {
  "use strict";
  const FM = (window.FM = window.FM || {});
  const KEY = "finance_master.v1";
  const UI_KEY = "finance_master.ui.v1";
  const VERSION = 1;

  /* ---------------- utilities ---------------- */
  const pad = (n) => String(n).padStart(2, "0");
  const num = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null || v === "") return 0;
    let s = String(v).trim().replace(/[R$\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    s = s.replace(/[^\d.-]/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => isoOf(new Date());
  const parseISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const addDaysISO = (iso, days) => {
    const d = parseISO(iso) || new Date();
    d.setDate(d.getDate() + num(days));
    return isoOf(d);
  };
  const addMonthsISO = (iso, n) => {
    const d = parseISO(iso) || new Date();
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + num(n), 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    return isoOf(target);
  };
  const addMonthsKey = (key, n) => {
    const [y, m] = String(key).split("-").map(Number);
    const d = new Date(y, m - 1 + num(n), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const monthKeyOf = (iso) => (iso ? String(iso).slice(0, 7) : "");
  const monthEnd = (key) => {
    const [y, m] = String(key).split("-").map(Number);
    return `${key}-${pad(new Date(y, m, 0).getDate())}`;
  };
  const monthStart = (key) => `${key}-01`;
  const dayDiff = (iso, base) => {
    const a = parseISO(iso);
    const b = parseISO(base || todayISO());
    if (!a || !b) return 0;
    return Math.round((a - b) / 86400000);
  };
  const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthLabel = (key, style) => {
    if (!key) return "—";
    const [y, m] = String(key).split("-").map(Number);
    if (style === "long") return `${MONTHS_LONG[m - 1]} de ${y}`;
    if (style === "short") return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
    return `${MONTHS_SHORT[m - 1]}/${y}`;
  };
  const lastMonthKeys = (n, endKey) => {
    const end = endKey || monthKeyOf(todayISO());
    const arr = [];
    for (let i = num(n) - 1; i >= 0; i--) arr.push(addMonthsKey(end, -i));
    return arr;
  };
  const fmtDate = (iso, style) => {
    if (!iso) return "—";
    const d = parseISO(iso);
    if (!d || isNaN(d)) return "—";
    if (style === "short") return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    if (style === "long") return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const fmtDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const relTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (!isFinite(diff)) return "—";
    const min = Math.round(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    if (d < 30) return `há ${d} d`;
    return new Date(ts).toLocaleDateString("pt-BR");
  };
  const money = (v) =>
    (isFinite(num(v)) ? num(v) : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const moneyShort = (v) => {
    const n = num(v);
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}R$ ${(abs / 1000000).toFixed(1).replace(".", ",")} mi`;
    if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toFixed(1).replace(".", ",")} mil`;
    return money(n);
  };
  const pct = (v, digits) => `${(num(v) * 100).toFixed(digits == null ? 0 : digits).replace(".", ",")}%`;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, num(v)));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const parseMoneyInput = (v) => round2(num(v));
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + num(b), 0) / arr.length : 0);
  const uid = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const downloadFile = (blob, filename) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 400);
  };
  const downloadCSV = (filename, headers, rows) => {
    const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = "\ufeff" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
    downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
  };

  const U = {
    pad, num, round2, isoOf, todayISO, parseISO, addDaysISO, addMonthsISO, addMonthsKey,
    monthKeyOf, monthEnd, monthStart, dayDiff, monthLabel, lastMonthKeys, MONTHS_SHORT,
    fmtDate, fmtDateTime, relTime, money, moneyShort, pct, clamp, esc, parseMoneyInput, mean,
    uid, downloadFile, downloadCSV,
  };

  /* ---------------- seed ---------------- */
  const DEFAULT_LISTS = {
    methods: ["PIX", "Dinheiro", "Cartão", "Boleto", "Transferência"],
    periodicities: ["Única", "Semanal", "Mensal", "Anual"],
    types: ["Receita", "Despesa"],
    statuses: ["Previsto", "Pago", "Recebido", "Parcial", "Atrasado", "Cancelado"],
  };

  function seedState() {
    const now = new Date().toISOString();
    const M = monthKeyOf(todayISO());
    const seedDate = (offset, day) => {
      const key = addMonthsKey(M, offset);
      const [y, m] = key.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return `${key}-${pad(Math.min(day, last))}`;
    };

    const accounts = [
      { id: "ACC-001", name: "Banco principal", institution: "Banco Exemplo", type: "Conta corrente", openingBalance: 10000, active: true },
      { id: "ACC-002", name: "Caixa físico", institution: "Caixa interno", type: "Caixa", openingBalance: 1500, active: true },
      { id: "ACC-003", name: "Reserva", institution: "Banco Exemplo", type: "Poupança", openingBalance: 5000, active: true },
    ];
    const categories = [
      ["Receitas", "Vendas", "Receita", "Vendas e serviços"],
      ["Receitas", "Doações", "Receita", "Contribuições e ofertas"],
      ["Operacional", "Materiais", "Despesa", "Materiais de consumo"],
      ["Operacional", "Serviços", "Despesa", "Serviços contratados"],
      ["Administrativo", "Aluguel", "Despesa", "Ocupação"],
      ["Administrativo", "Internet e telefone", "Despesa", "Comunicação"],
      ["Pessoal", "Salários", "Despesa", "Remuneração da equipe"],
      ["Financeiro", "Tarifas e juros", "Despesa", "Custos financeiros"],
      ["Investimentos", "Equipamentos", "Despesa", "Aquisição de ativos"],
    ].map((c, i) => ({ id: `CAT-${pad(i + 1)}`, name: c[0], subcategory: c[1], type: c[2], description: c[3] }));

    const costCenters = [
      { id: "CC-001", name: "Administrativo", owner: "Coordenação", monthlyBudget: 5000, note: "Exemplo" },
      { id: "CC-002", name: "Operacional", owner: "Operações", monthlyBudget: 8000, note: "Exemplo" },
      { id: "CC-003", name: "Projetos", owner: "Gestor", monthlyBudget: 3000, note: "Exemplo" },
      { id: "CC-004", name: "Comercial", owner: "Vendas", monthlyBudget: 4000, note: "Exemplo" },
    ];

    const transactions = [];
    let seq = 0;
    function addTx(o) {
      seq += 1;
      const id = `LAN-${String(seq).padStart(4, "0")}`;
      const settle = o.settle || null;
      const t = {
        id,
        date: o.date,
        type: o.type,
        description: o.description,
        category: o.category,
        subcategory: o.subcategory,
        account: o.account,
        costCenter: o.costCenter || "",
        amount: round2(o.amount),
        dueDate: o.dueDate || o.date,
        paidDate: settle || null,
        status: settle ? (o.type === "receita" ? "Recebido" : "Pago") : "Previsto",
        method: o.method || "PIX",
        note: o.note || "",
        document: o.document || "",
        payments: settle ? [{ id: `PG-${id}`, date: settle, amount: round2(o.amount), account: o.account, note: "" }] : [],
        groupId: o.groupId || null,
        createdAt: now,
        updatedAt: now,
        cancelled: false,
      };
      transactions.push(t);
      return t;
    }

    // Histórico (5 meses anteriores ao atual)
    for (let off = -5; off <= -1; off++) {
      const label = monthLabel(addMonthsKey(M, off), "long");
      addTx({ date: seedDate(off, 1), type: "receita", description: `Serviços de ${label}`, category: "Receitas", subcategory: "Vendas", account: "ACC-001", costCenter: "Comercial", amount: 5200, dueDate: seedDate(off, 1), settle: seedDate(off, 1) });
      addTx({ date: seedDate(off, 5), type: "despesa", description: "Aluguel do espaço", category: "Administrativo", subcategory: "Aluguel", account: "ACC-001", costCenter: "Administrativo", amount: 1800, dueDate: seedDate(off, 5), settle: seedDate(off, 5), method: "Transferência" });
      addTx({ date: seedDate(off, 10), type: "despesa", description: "Salários da equipe", category: "Pessoal", subcategory: "Salários", account: "ACC-001", costCenter: "Administrativo", amount: 4200, dueDate: seedDate(off, 10), settle: seedDate(off, 10), method: "Transferência" });
      addTx({ date: seedDate(off, 12), type: "receita", description: "Doações do culto", category: "Receitas", subcategory: "Doações", account: "ACC-002", costCenter: "Projetos", amount: 900, dueDate: seedDate(off, 12), settle: seedDate(off, 12), method: "Dinheiro" });
      addTx({ date: seedDate(off, 18), type: "despesa", description: "Materiais de consumo", category: "Operacional", subcategory: "Materiais", account: "ACC-001", costCenter: "Operacional", amount: 380, dueDate: seedDate(off, 18), settle: seedDate(off, 18) });
      addTx({ date: seedDate(off, 20), type: "despesa", description: "Internet e telefone", category: "Administrativo", subcategory: "Internet e telefone", account: "ACC-001", costCenter: "Administrativo", amount: 220, dueDate: seedDate(off, 20), settle: seedDate(off, 20), method: "Boleto" });
      addTx({ date: seedDate(off, 22), type: "receita", description: "Evento do mês", category: "Receitas", subcategory: "Vendas", account: "ACC-001", costCenter: "Projetos", amount: 800, dueDate: seedDate(off, 22), settle: seedDate(off, 22) });
      addTx({ date: seedDate(off, 25), type: "despesa", description: "Manutenção", category: "Operacional", subcategory: "Serviços", account: "ACC-001", costCenter: "Operacional", amount: 250, dueDate: seedDate(off, 25), settle: seedDate(off, 25) });
    }

    // Mês atual — dados de referência da planilha
    addTx({ date: seedDate(0, 3), type: "receita", description: "Serviço prestado", category: "Receitas", subcategory: "Vendas", account: "ACC-001", costCenter: "Comercial", amount: 4500, dueDate: seedDate(0, 3), settle: seedDate(0, 3), note: "Exemplo da planilha" });
    addTx({ date: seedDate(0, 5), type: "despesa", description: "Aluguel do espaço", category: "Administrativo", subcategory: "Aluguel", account: "ACC-001", costCenter: "Administrativo", amount: 1800, dueDate: seedDate(0, 5), settle: seedDate(0, 5), method: "Transferência" });
    addTx({ date: seedDate(0, 5), type: "despesa", description: "Compra de materiais", category: "Operacional", subcategory: "Materiais", account: "ACC-001", costCenter: "Operacional", amount: 850, dueDate: seedDate(0, 10), settle: seedDate(0, 10), note: "Fornecedor Alfa" });
    addTx({ date: seedDate(0, 8), type: "despesa", description: "Internet e telefone", category: "Administrativo", subcategory: "Internet e telefone", account: "ACC-001", costCenter: "Administrativo", amount: 220, dueDate: seedDate(0, 20), method: "Boleto", note: "A vencer" });
    addTx({ date: seedDate(0, 10), type: "despesa", description: "Salários de " + monthLabel(M, "long"), category: "Pessoal", subcategory: "Salários", account: "ACC-001", costCenter: "Administrativo", amount: 4500, dueDate: seedDate(0, 10), settle: seedDate(0, 10), method: "Transferência" });
    addTx({ date: seedDate(0, 10), type: "receita", description: "Projeto recebido", category: "Receitas", subcategory: "Doações", account: "ACC-002", costCenter: "Projetos", amount: 1200, dueDate: seedDate(0, 10), settle: seedDate(0, 10), method: "Dinheiro", note: "Exemplo da planilha" });
    addTx({ date: seedDate(0, 12), type: "despesa", description: "Manutenção", category: "Operacional", subcategory: "Serviços", account: "ACC-001", costCenter: "Operacional", amount: 600, dueDate: seedDate(0, 18), method: "Transferência", note: "Oficina Beta" });
    addTx({ date: seedDate(0, 14), type: "despesa", description: "Tarifa bancária", category: "Financeiro", subcategory: "Tarifas e juros", account: "ACC-001", costCenter: "Administrativo", amount: 45, dueDate: seedDate(0, 14), settle: seedDate(0, 14), note: "Exemplo da planilha" });
    addTx({ date: seedDate(0, 16), type: "receita", description: "Evento beneficente", category: "Receitas", subcategory: "Doações", account: "ACC-001", costCenter: "Projetos", amount: 3200, dueDate: seedDate(0, 16), settle: seedDate(0, 16) });
    addTx({ date: seedDate(0, 18), type: "receita", description: "Mensalidade cliente", category: "Receitas", subcategory: "Vendas", account: "ACC-001", costCenter: "Comercial", amount: 950, dueDate: seedDate(0, 25), note: "Cliente Beta" });

    // Parcelamento demonstrativo
    const groupId = "PRC-0001";
    const firstDue = seedDate(0, 28);
    const totalParcel = 3600;
    for (let i = 1; i <= 6; i++) {
      const amount = i < 6 ? 600 : 600;
      addTx({
        date: seedDate(0, 20), type: "despesa",
        description: `Notebook da secretaria (${i}/6)`,
        category: "Investimentos", subcategory: "Equipamentos",
        account: "ACC-001", costCenter: "Administrativo",
        amount, dueDate: addMonthsISO(firstDue, i - 1), method: "Boleto",
        note: "Parcelamento demonstrativo", groupId,
      });
    }
    const installmentGroups = [{
      id: groupId, description: "Notebook da secretaria", type: "despesa",
      totalAmount: totalParcel, count: 6, category: "Investimentos", subcategory: "Equipamentos",
      account: "ACC-001", costCenter: "Administrativo", method: "Boleto",
      firstDue, createdAt: now, cancelled: false,
    }];

    // Próximo mês — previsões
    addTx({ date: seedDate(1, 5), type: "despesa", description: "Salários de " + monthLabel(addMonthsKey(M, 1), "long"), category: "Pessoal", subcategory: "Salários", account: "ACC-001", costCenter: "Administrativo", amount: 4500, dueDate: seedDate(1, 5), method: "Transferência" });
    addTx({ date: seedDate(1, 5), type: "despesa", description: "Aluguel do espaço", category: "Administrativo", subcategory: "Aluguel", account: "ACC-001", costCenter: "Administrativo", amount: 1800, dueDate: seedDate(1, 5), method: "Transferência" });
    addTx({ date: seedDate(1, 10), type: "receita", description: "Projeto de fim de ano", category: "Receitas", subcategory: "Doações", account: "ACC-001", costCenter: "Projetos", amount: 2400, dueDate: seedDate(1, 10) });
    addTx({ date: seedDate(1, 15), type: "despesa", description: "Compra de equipamentos", category: "Investimentos", subcategory: "Equipamentos", account: "ACC-001", costCenter: "Operacional", amount: 1200, dueDate: seedDate(1, 15), method: "Boleto" });

    const transfers = [{
      id: "TR-001", date: seedDate(0, 15), fromAccount: "ACC-001", toAccount: "ACC-002",
      amount: 300, fee: 0, note: "Reforço de caixa para despesas miúdas",
    }];

    const budgets = [];
    let bseq = 0;
    function addBudget(off, category, costCenter, planned) {
      bseq += 1;
      budgets.push({ id: `BGT-${pad(bseq, 3)}`, month: addMonthsKey(M, off), category, costCenter, planned });
    }
    [-1, 0, 1].forEach((off) => {
      addBudget(off, "Operacional", "Operacional", off === 1 ? 3000 : 2500);
      addBudget(off, "Administrativo", "Administrativo", 2200);
      addBudget(off, "Pessoal", "Administrativo", off === 1 ? 5500 : 5000);
      addBudget(off, "Financeiro", "Administrativo", 300);
      addBudget(off, "Investimentos", "Administrativo", off === 1 ? 3000 : 1500);
    });

    const reconciliations = [
      { id: "REC-001", date: seedDate(0, 3), account: "ACC-001", description: "Crédito serviço", statementAmount: 4500, systemAmount: 4500, reconciled: true, note: "Exemplo" },
      { id: "REC-002", date: seedDate(0, 5), account: "ACC-001", description: "Compra materiais", statementAmount: -850, systemAmount: -850, reconciled: true, note: "Exemplo" },
      { id: "REC-003", date: seedDate(0, 20), account: "ACC-001", description: "Boleto internet", statementAmount: -220, systemAmount: 0, reconciled: false, note: "Lançamento ainda não identificado no sistema" },
    ];

    return {
      version: VERSION,
      meta: { org: "Luvis Finance", createdAt: now, updatedAt: now },
      accounts, categories, costCenters, transactions, transfers,
      budgets, reconciliations, installmentGroups,
      settings: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
      audit: [{ id: uid("AUD"), ts: now, action: "Sistema inicializado", entity: "Demonstração", ref: "—", detail: "Dados fictícios carregados a partir do modelo." }],
    };
  }

  function emptyState() {
    return {
      version: VERSION,
      meta: { org: "Luvis Finance", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      accounts: [], categories: [], costCenters: [], transactions: [], transfers: [],
      budgets: [], reconciliations: [], installmentGroups: [],
      settings: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
      audit: [],
    };
  }

  /* ---------------- store ---------------- */
  const store = {
    state: null,
    ui: { month: monthKeyOf(todayISO()), txFilters: {} },
    _initDone: false,

    init() {
      let loaded = null;
      try {
        loaded = JSON.parse(localStorage.getItem(KEY) || "null");
      } catch (e) {
        loaded = null;
      }
      if (!loaded || loaded.version !== VERSION || !Array.isArray(loaded.transactions)) {
        loaded = seedState();
      }
      // normalização defensiva
      loaded.settings = Object.assign({}, DEFAULT_LISTS, loaded.settings || {});
      loaded.meta = Object.assign({ org: "Luvis Finance" }, loaded.meta || {});
      delete loaded.meta.theme;
      const legacyOrg = ["Ministério AMI", "Minha organização"];
      if (!loaded.meta.org || legacyOrg.includes(loaded.meta.org)) loaded.meta.org = "Luvis Finance";
      loaded.audit = loaded.audit || [];
      loaded.installmentGroups = loaded.installmentGroups || [];
      this.state = loaded;
      try {
        const ui = JSON.parse(localStorage.getItem(UI_KEY) || "null");
        if (ui && /^\d{4}-\d{2}$/.test(ui.month || "")) this.ui.month = ui.month;
      } catch (e) {}
      this.save({ silent: true });
    },

    save(opts) {
      try {
        this.state.meta.updatedAt = new Date().toISOString();
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error("Falha ao salvar dados", e);
        if (FM.ui && FM.ui.toast) FM.ui.toast("Não foi possível salvar os dados neste navegador.", "error");
      }
      if (!opts || !opts.silent) {
        if (FM.app && FM.app.onDataChanged) FM.app.onDataChanged();
      }
    },

    setMonth(key) {
      if (!/^\d{4}-\d{2}$/.test(key || "")) return;
      this.ui.month = key;
      try { localStorage.setItem(UI_KEY, JSON.stringify(this.ui)); } catch (e) {}
    },

    addAudit(action, entity, ref, detail) {
      this.state.audit.unshift({ id: uid("AUD"), ts: new Date().toISOString(), action, entity: entity || "—", ref: ref || "—", detail: detail || "" });
      if (this.state.audit.length > 300) this.state.audit.length = 300;
    },

    nextId(list, prefix, width) {
      let max = 0;
      (list || []).forEach((x) => {
        const m = String(x && x.id ? x.id : "").match(/(\d+)\s*$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return `${prefix}-${String(max + 1).padStart(width || 4, "0")}`;
    },

    exportJSON() {
      const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
      const name = `luvis-finance-backup-${todayISO()}.json`;
      downloadFile(blob, name);
    },
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Arquivo inválido: não é um JSON válido."); }
      if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
        throw new Error("Backup inválido: estrutura não reconhecida.");
      }
      data.version = VERSION;
      data.settings = Object.assign({}, DEFAULT_LISTS, data.settings || {});
      data.meta = Object.assign({ org: "Luvis Finance" }, data.meta || {});
      delete data.meta.theme;
      data.audit = data.audit || [];
      data.installmentGroups = data.installmentGroups || [];
      this.state = data;
      this.addAudit("Backup restaurado", "Sistema", "—", "Dados importados de arquivo JSON.");
      this.save();
    },
    restoreDemo() {
      this.state = seedState();
      this.save();
    },
    clearAll() {
      this.state = emptyState();
      this.addAudit("Dados apagados", "Sistema", "—", "Todos os cadastros e lançamentos foram removidos.");
      this.save();
    },
  };

  /* ---------------- cálculos ---------------- */
  const calc = {
    txById(id) { return store.state.transactions.find((t) => t.id === id) || null; },
    accountById(id) { return store.state.accounts.find((a) => a.id === id) || null; },
    accountName(id) { const a = this.accountById(id); return a ? a.name : "—"; },
    payments(t) { return ((t && t.payments) || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")); },
    paidTotal(t) { return round2(((t && t.payments) || []).reduce((s, p) => s + num(p.amount), 0)); },
    remaining(t) { return round2(Math.max(0, num(t && t.amount) - this.paidTotal(t))); },
    isCancelled(t) { return !!(t && (t.cancelled || t.status === "Cancelado")); },
    isOpen(t) { return t && !this.isCancelled(t) && this.remaining(t) > 0.004; },

    effectiveStatus(t) {
      if (!t) return "—";
      if (this.isCancelled(t)) return "Cancelado";
      const rem = this.remaining(t);
      if (rem <= 0.004) return t.type === "receita" ? "Recebido" : "Pago";
      if (this.paidTotal(t) > 0.004) return "Parcial";
      if (t.dueDate && t.dueDate < todayISO()) return "Atrasado";
      return "Previsto";
    },
    statusTone(status) {
      return {
        "Pago": "ok", "Recebido": "ok", "Previsto": "primary", "Parcial": "warn",
        "Atrasado": "danger", "Cancelado": "muted",
      }[status] || "muted";
    },

    accountBalance(accountId, untilISO) {
      const acc = this.accountById(accountId);
      if (!acc) return 0;
      let bal = num(acc.openingBalance);
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t)) return;
        (t.payments || []).forEach((p) => {
          if ((p.account || t.account) !== accountId) return;
          if (untilISO && p.date > untilISO) return;
          bal += t.type === "receita" ? num(p.amount) : -num(p.amount);
        });
      });
      store.state.transfers.forEach((tr) => {
        if (untilISO && tr.date > untilISO) return;
        if (tr.fromAccount === accountId) bal -= num(tr.amount);
        if (tr.toAccount === accountId) bal += num(tr.amount);
      });
      return round2(bal);
    },
    consolidatedBalance(untilISO) {
      return round2(store.state.accounts.reduce((s, a) => s + this.accountBalance(a.id, untilISO), 0));
    },

    paymentsInMonth(filter) {
      const out = [];
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t)) return;
        if (filter && filter.type && t.type !== filter.type) return;
        (t.payments || []).forEach((p) => {
          if (filter && filter.month && monthKeyOf(p.date) !== filter.month) return;
          out.push({ tx: t, payment: p });
        });
      });
      return out;
    },

    monthStats(key) {
      const start = monthStart(key);
      const end = monthEnd(key);
      let receitasRecebidas = 0;
      let despesasPagas = 0;
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t)) return;
        (t.payments || []).forEach((p) => {
          if (!p.date || p.date < start || p.date > end) return;
          if (t.type === "receita") receitasRecebidas += num(p.amount);
          else despesasPagas += num(p.amount);
        });
      });
      let entradasPrevistas = 0;
      let saidasPrevistas = 0;
      let countReceber = 0;
      let countPagar = 0;
      store.state.transactions.forEach((t) => {
        if (!this.isOpen(t)) return;
        if (!t.dueDate || monthKeyOf(t.dueDate) !== key) return;
        const rem = this.remaining(t);
        if (t.type === "receita") { entradasPrevistas += rem; countReceber += 1; }
        else { saidasPrevistas += rem; countPagar += 1; }
      });
      const saldoInicial = this.consolidatedBalance(addDaysISO(start, -1));
      const saldoFinal = round2(saldoInicial + receitasRecebidas - despesasPagas);
      const saldoProjetado = round2(saldoFinal + entradasPrevistas - saidasPrevistas);
      return {
        key, receitasRecebidas: round2(receitasRecebidas), despesasPagas: round2(despesasPagas),
        resultado: round2(receitasRecebidas - despesasPagas),
        entradasPrevistas: round2(entradasPrevistas), saidasPrevistas: round2(saidasPrevistas),
        countReceber, countPagar, saldoInicial, saldoFinal, saldoProjetado,
      };
    },
    monthlySeries(keys) {
      return (keys || []).map((k) => Object.assign(this.monthStats(k), { label: monthLabel(k, "short") }));
    },
    categorySpend(key, type) {
      const map = new Map();
      this.paymentsInMonth({ month: key, type: type || "despesa" }).forEach(({ tx, payment }) => {
        const k = tx.category || "Sem categoria";
        const cur = map.get(k) || { name: k, total: 0, count: 0 };
        cur.total += num(payment.amount);
        cur.count += 1;
        map.set(k, cur);
      });
      return Array.from(map.values()).map((x) => Object.assign(x, { total: round2(x.total) })).sort((a, b) => b.total - a.total);
    },
    categoryIncome(key) { return this.categorySpend(key, "receita"); },

    openTotals(type) {
      let total = 0, count = 0, overdueTotal = 0, overdueCount = 0, soonTotal = 0, soonCount = 0;
      const today = todayISO();
      store.state.transactions.forEach((t) => {
        if (t.type !== type || !this.isOpen(t)) return;
        const rem = this.remaining(t);
        total += rem; count += 1;
        if (t.dueDate && t.dueDate < today) { overdueTotal += rem; overdueCount += 1; }
        else if (t.dueDate && dayDiff(t.dueDate) <= 7) { soonTotal += rem; soonCount += 1; }
      });
      return { total: round2(total), count, overdue: { total: round2(overdueTotal), count: overdueCount }, soon: { total: round2(soonTotal), count: soonCount } };
    },

    budgetRows(key) {
      const rows = [];
      const monthPayments = this.paymentsInMonth({ month: key, type: "despesa" });
      store.state.budgets.filter((b) => b.month === key).forEach((b) => {
        let actual = 0;
        monthPayments.forEach(({ tx, payment }) => {
          if (tx.category !== b.category) return;
          if (b.costCenter && tx.costCenter !== b.costCenter) return;
          actual += num(payment.amount);
        });
        actual = round2(actual);
        const planned = num(b.planned);
        const usage = planned > 0 ? actual / planned : 0;
        rows.push({ budget: b, category: b.category, costCenter: b.costCenter, planned, actual, remaining: round2(planned - actual), usage, over: actual > planned + 0.004 });
      });
      return rows.sort((a, b) => b.usage - a.usage);
    },
    budgetTotals(key) {
      const rows = this.budgetRows(key);
      const planned = round2(rows.reduce((s, r) => s + r.planned, 0));
      const actual = round2(rows.reduce((s, r) => s + r.actual, 0));
      return { planned, actual, usage: planned > 0 ? actual / planned : 0, rows };
    },

    alerts() {
      const pay = this.openTotals("despesa");
      const rec = this.openTotals("receita");
      const budgets = this.budgetRows(store.ui.month).filter((r) => r.usage >= 0.85);
      return { pay, rec, budgets };
    },

    insights(key) {
      const out = [];
      const s = this.monthStats(key);
      const prevKey = addMonthsKey(key, -1);
      const prev = this.monthStats(prevKey);
      const cash = this.consolidatedBalance();
      const pay = this.openTotals("despesa");
      const rec = this.openTotals("receita");

      if (s.receitasRecebidas > 0 || s.despesasPagas > 0) {
        const margin = s.receitasRecebidas > 0 ? s.resultado / s.receitasRecebidas : 0;
        if (s.resultado >= 0) {
          out.push({
            tone: "positive", icon: "trending-up",
            title: `Resultado positivo de ${money(s.resultado)}`,
            text: `Você recebeu ${money(s.receitasRecebidas)} e pagou ${money(s.despesasPagas)} em ${monthLabel(key, "long")} — margem de ${pct(margin)}. ${prev.receitasRecebidas > 0 ? `No mês anterior o resultado foi ${money(prev.resultado)}.` : ""}`,
            link: { route: "dre", label: "Ver DRE gerencial" },
          });
        } else {
          out.push({
            tone: "danger", icon: "trending-down",
            title: `Resultado negativo de ${money(Math.abs(s.resultado))}`,
            text: `As despesas pagas superaram as receitas recebidas no período. Revise gastos variáveis e antecipe recebimentos. Margem atual: ${pct(margin)}.`,
            link: { route: "a-pagar", label: "Revisar contas a pagar" },
          });
        }
      }

      if (pay.overdue.count > 0) {
        out.push({
          tone: "danger", icon: "alert",
          title: `${pay.overdue.count} obrigação(ões) vencida(s)`,
          text: `${money(pay.overdue.total)} em contas a pagar passaram do vencimento. Priorize a regularização para evitar juros, multas e bloqueio de fornecedores.`,
          link: { route: "a-pagar", label: "Ver vencidos" },
        });
      } else if (pay.soon.count > 0) {
        out.push({
          tone: "warn", icon: "clock",
          title: `${pay.soon.count} conta(s) vencem em até 7 dias`,
          text: `${money(pay.soon.total)} a pagar nos próximos dias. Confirme o saldo da conta escolhida antes da baixa.`,
          link: { route: "a-pagar", label: "Planejar pagamentos" },
        });
      }

      const budgetRows = this.budgetRows(key);
      const worst = budgetRows.filter((r) => r.planned > 0).sort((a, b) => b.usage - a.usage)[0];
      if (worst && worst.usage >= 0.8) {
        out.push({
          tone: worst.over ? "danger" : "warn", icon: "target",
          title: `Orçamento de ${worst.category} em ${pct(worst.usage)}`,
          text: worst.over
            ? `O realizado (${money(worst.actual)}) já superou o planejado (${money(worst.planned)}) em ${money(Math.abs(worst.remaining))}. Reveja a categoria ou ajuste o plano.`
            : `Já foram usados ${money(worst.actual)} de ${money(worst.planned)}. Restam ${money(worst.remaining)} até o fim do mês.`,
          link: { route: "orcamento", label: "Ajustar orçamento" },
        });
      }

      const cats = this.categorySpend(key, "despesa");
      if (cats.length && s.despesasPagas > 0) {
        const top = cats[0];
        const share = top.total / s.despesasPagas;
        if (share >= 0.5) {
          out.push({
            tone: "tip", icon: "pie",
            title: `${top.name} concentra ${pct(share)} das despesas`,
            text: `Concentração alta em uma única categoria aumenta a exposição. Negocie contratos, peça cotações e acompanhe a evolução nos próximos meses.`,
            link: { route: "relatorios", label: "Analisar por categoria" },
          });
        }
      }

      const expKeys = lastMonthKeys(3, key);
      const avgExp = mean(expKeys.map((k) => this.monthStats(k).despesasPagas));
      if (avgExp > 0) {
        const reserveMonths = cash / avgExp;
        if (reserveMonths < 1) {
          out.push({
            tone: "danger", icon: "shield",
            title: "Reserva de caixa insuficiente",
            text: `O saldo atual cobre cerca de ${reserveMonths.toFixed(1)} mês(es) do gasto médio. O ideal é manter de 3 a 6 meses de despesas em reserva.`,
            link: { route: "fluxo-caixa", label: "Projetar fluxo" },
          });
        } else if (reserveMonths >= 3) {
          out.push({
            tone: "positive", icon: "shield",
            title: `Reserva saudável: ${reserveMonths.toFixed(1)} meses`,
            text: `Seu saldo cobre ${reserveMonths.toFixed(1)} meses de despesas médias. Considere separar excedentes em conta de reserva e definir metas de investimento.`,
            link: { route: "contas", label: "Ver contas" },
          });
        }
      }

      if (rec.overdue.count > 0) {
        out.push({
          tone: "warn", icon: "clock",
          title: `${rec.overdue.count} recebimento(s) em atraso`,
          text: `${money(rec.overdue.total)} ainda não entraram. Faça a cobrança e registre a baixa assim que o valor cair na conta.`,
          link: { route: "a-receber", label: "Ver recebíveis" },
        });
      }

      if (!out.length) {
        out.push({
          tone: "tip", icon: "sparkles",
          title: "Comece registrando suas movimentações",
          text: "Cadastre contas, categorias e lance receitas e despesas. O sistema calcula saldo, resultado, projeções e orçamento automaticamente.",
          link: { route: "lancamentos", label: "Novo lançamento" },
        });
      }
      return out.slice(0, 5);
    },

    search(query) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return [];
      return store.state.transactions
        .filter((t) => {
          const hay = [t.id, t.description, t.category, t.subcategory, t.costCenter, this.accountName(t.account), t.note]
            .join(" ").toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 8);
    },

    groupInstallments(groupId) {
      return store.state.transactions.filter((t) => t.groupId === groupId).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    },

    auditFor(ref) { return store.state.audit.filter((a) => a.ref === ref).slice(0, 12); },
  };

  /* ---------------- ações (regras de negócio) ---------------- */
  function findCategory(name, sub) {
    return store.state.categories.find((c) => c.name === name && c.subcategory === sub) || null;
  }
  function requireCategory(name, sub, type) {
    const c = findCategory(name, sub);
    if (!c) throw new Error("Categoria não encontrada. Cadastre a categoria antes de lançar.");
    if (type && String(c.type).toLowerCase() !== String(type).toLowerCase()) throw new Error("A categoria selecionada não pertence ao tipo do lançamento.");
    return c;
  }

  const actions = {
    saveTransaction(data, id) {
      const type = data.type === "receita" ? "receita" : "despesa";
      if (!data.description || !String(data.description).trim()) throw new Error("Informe uma descrição.");
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error("O valor deve ser maior que zero.");
      if (!data.date) throw new Error("Informe a data do lançamento.");
      if (!data.account || !calc.accountById(data.account)) throw new Error("Selecione uma conta válida.");
      requireCategory(data.category, data.subcategory, type);
      const existing = id ? calc.txById(id) : null;

      if (existing) {
        if (calc.isCancelled(existing)) throw new Error("Lançamento cancelado não pode ser editado.");
        if (existing.payments && existing.payments.length && existing.type !== type) {
          throw new Error("Não é possível alterar o tipo de um lançamento que já possui baixas.");
        }
        const paid = calc.paidTotal(existing);
        if (amount + 0.004 < paid) throw new Error(`O valor não pode ser menor que o total já baixado (${money(paid)}).`);
        Object.assign(existing, {
          type,
          description: String(data.description).trim(),
          category: data.category,
          subcategory: data.subcategory,
          account: data.account,
          costCenter: data.costCenter || "",
          amount,
          date: data.date,
          dueDate: data.dueDate || data.date,
          method: data.method || "PIX",
          note: data.note || "",
          document: data.document || "",
          updatedAt: new Date().toISOString(),
        });
        if (existing.groupId) {
          const g = store.state.installmentGroups.find((x) => x.id === existing.groupId);
          if (g) { g.category = data.category; g.subcategory = data.subcategory; g.account = data.account; g.costCenter = data.costCenter || ""; }
        }
        store.addAudit("Lançamento editado", "Lançamento", existing.id, `${existing.description} — ${money(existing.amount)}`);
        store.save();
        return existing;
      }

      const tx = {
        id: store.nextId(store.state.transactions, "LAN", 4),
        type,
        description: String(data.description).trim(),
        category: data.category,
        subcategory: data.subcategory,
        account: data.account,
        costCenter: data.costCenter || "",
        amount,
        date: data.date,
        dueDate: data.dueDate || data.date,
        paidDate: null,
        status: "Previsto",
        method: data.method || "PIX",
        note: data.note || "",
        document: data.document || "",
        payments: [],
        groupId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cancelled: false,
      };
      if (data.settleNow) {
        const pdate = data.settleDate || data.dueDate || data.date;
        tx.payments.push({ id: `PG-${tx.id}-1`, date: pdate, amount, account: data.account, note: "Baixa na criação" });
        tx.paidDate = pdate;
        tx.status = type === "receita" ? "Recebido" : "Pago";
      }
      store.state.transactions.unshift(tx);
      store.addAudit("Lançamento criado", "Lançamento", tx.id, `${tx.description} — ${money(tx.amount)}`);
      store.save();
      return tx;
    },

    registerPayment(id, data) {
      const tx = calc.txById(id);
      if (!tx) throw new Error("Lançamento não encontrado.");
      if (calc.isCancelled(tx)) throw new Error("Lançamento cancelado.");
      const amount = round2(data.amount);
      const remaining = calc.remaining(tx);
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (amount > remaining + 0.004) throw new Error(`O valor excede o saldo em aberto (${money(remaining)}).`);
      if (!data.date) throw new Error("Informe a data da baixa.");
      if (!data.account || !calc.accountById(data.account)) throw new Error("Selecione a conta da baixa.");
      tx.payments = tx.payments || [];
      const newRemaining = round2(remaining - amount);
      tx.payments.push({
        id: `PG-${tx.id}-${tx.payments.length + 1}`,
        date: data.date,
        amount,
        account: data.account,
        note: data.note || "",
      });
      tx.paidDate = data.date;
      tx.status = newRemaining <= 0.004 ? (tx.type === "receita" ? "Recebido" : "Pago") : "Parcial";
      tx.updatedAt = new Date().toISOString();
      store.addAudit("Baixa registrada", "Lançamento", tx.id, `${tx.description} — ${money(amount)} em ${fmtDate(data.date)}`);
      store.save();
      return tx;
    },

    reversePayment(id, paymentId) {
      const tx = calc.txById(id);
      if (!tx) throw new Error("Lançamento não encontrado.");
      const idx = (tx.payments || []).findIndex((p) => p.id === paymentId);
      if (idx < 0) throw new Error("Baixa não encontrada.");
      const p = tx.payments[idx];
      tx.payments.splice(idx, 1);
      tx.paidDate = tx.payments.length ? tx.payments[tx.payments.length - 1].date : null;
      tx.updatedAt = new Date().toISOString();
      store.addAudit("Baixa estornada", "Lançamento", tx.id, `${tx.description} — ${money(p.amount)}`);
      store.save();
      return tx;
    },

    cancelTransaction(id, reason) {
      const tx = calc.txById(id);
      if (!tx) throw new Error("Lançamento não encontrado.");
      if (!reason || !String(reason).trim()) throw new Error("Informe o motivo do cancelamento.");
      tx.cancelled = true;
      tx.status = "Cancelado";
      tx.cancelledAt = new Date().toISOString();
      tx.cancelReason = String(reason).trim();
      tx.updatedAt = new Date().toISOString();
      store.addAudit("Lançamento cancelado", "Lançamento", tx.id, `${tx.description} — motivo: ${tx.cancelReason}`);
      store.save();
      return tx;
    },

    saveTransfer(data) {
      if (!data.fromAccount || !data.toAccount) throw new Error("Informe a conta de origem e o destino.");
      if (data.fromAccount === data.toAccount) throw new Error("Origem e destino devem ser diferentes.");
      if (!calc.accountById(data.fromAccount) || !calc.accountById(data.toAccount)) throw new Error("Conta inválida.");
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (!data.date) throw new Error("Informe a data da transferência.");
      const fee = Math.max(0, round2(data.fee));
      const tr = {
        id: store.nextId(store.state.transfers, "TR", 3),
        date: data.date,
        fromAccount: data.fromAccount,
        toAccount: data.toAccount,
        amount,
        fee,
        note: data.note || "",
      };
      store.state.transfers.unshift(tr);

      if (fee > 0) {
        const finCat = store.state.categories.find((c) => c.name === "Financeiro" && c.type === "Despesa")
          || store.state.categories.find((c) => c.type === "Despesa");
        const feeTx = {
          id: store.nextId(store.state.transactions, "LAN", 4),
          type: "despesa",
          description: `Taxa de transferência ${tr.id}`,
          category: finCat ? finCat.name : "Financeiro",
          subcategory: finCat ? finCat.subcategory : "Tarifas e juros",
          account: tr.fromAccount,
          costCenter: "Administrativo",
          amount: fee,
          date: data.date,
          dueDate: data.date,
          paidDate: data.date,
          status: "Pago",
          method: "Transferência",
          note: `Taxa vinculada à transferência ${tr.id}`,
          document: "",
          payments: [{ id: `PG-${tr.id}`, date: data.date, amount: fee, account: tr.fromAccount, note: "" }],
          groupId: `TRF:${tr.id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cancelled: false,
        };
        store.state.transactions.unshift(feeTx);
      }
      store.addAudit("Transferência registrada", "Transferência", tr.id, `${calc.accountName(tr.fromAccount)} → ${calc.accountName(tr.toAccount)} — ${money(amount)}`);
      store.save();
      return tr;
    },

    deleteTransfer(id) {
      const idx = store.state.transfers.findIndex((t) => t.id === id);
      if (idx < 0) throw new Error("Transferência não encontrada.");
      const tr = store.state.transfers[idx];
      store.state.transfers.splice(idx, 1);
      store.state.transactions = store.state.transactions.filter((t) => t.groupId !== `TRF:${tr.id}`);
      store.addAudit("Transferência excluída", "Transferência", id, `${money(tr.amount)} — registro removido`);
      store.save();
    },

    saveAccount(data, id) {
      if (!data.name || !String(data.name).trim()) throw new Error("Informe o nome da conta.");
      if (id) {
        const acc = store.state.accounts.find((a) => a.id === id);
        if (!acc) throw new Error("Conta não encontrada.");
        Object.assign(acc, {
          name: String(data.name).trim(), institution: data.institution || "", type: data.type || "Conta corrente",
          openingBalance: round2(data.openingBalance), active: data.active !== false,
        });
        store.addAudit("Conta editada", "Conta", acc.id, `${acc.name}`);
      } else {
        const acc = {
          id: store.nextId(store.state.accounts, "ACC", 3),
          name: String(data.name).trim(), institution: data.institution || "",
          type: data.type || "Conta corrente", openingBalance: round2(data.openingBalance), active: true,
        };
        store.state.accounts.push(acc);
        store.addAudit("Conta criada", "Conta", acc.id, `${acc.name}`);
      }
      store.save();
    },
    toggleAccount(id) {
      const acc = store.state.accounts.find((a) => a.id === id);
      if (!acc) return;
      acc.active = !acc.active;
      store.addAudit(acc.active ? "Conta reativada" : "Conta desativada", "Conta", acc.id, acc.name);
      store.save();
    },

    saveCategory(data, id) {
      if (!data.name || !data.subcategory) throw new Error("Informe categoria e subcategoria.");
      if (!["Receita", "Despesa"].includes(data.type)) throw new Error("Tipo inválido.");
      const dup = store.state.categories.find((c) => c.name === data.name && c.subcategory === data.subcategory && c.id !== id);
      if (dup) throw new Error("Já existe uma subcategoria com esse nome nesta categoria.");
      if (id) {
        const cat = store.state.categories.find((c) => c.id === id);
        if (!cat) throw new Error("Categoria não encontrada.");
        const used = store.state.transactions.some((t) => t.category === cat.name && t.subcategory === cat.subcategory);
        if (used && (cat.name !== data.name || cat.subcategory !== data.subcategory)) {
          throw new Error("Categoria em uso não pode ser renomeada. Crie uma nova e reclassifique os lançamentos.");
        }
        Object.assign(cat, { name: data.name, subcategory: data.subcategory, type: data.type, description: data.description || "" });
        store.addAudit("Categoria editada", "Categoria", cat.id, `${cat.name} › ${cat.subcategory}`);
      } else {
        const cat = {
          id: store.nextId(store.state.categories, "CAT", 2),
          name: data.name, subcategory: data.subcategory, type: data.type, description: data.description || "",
        };
        store.state.categories.push(cat);
        store.addAudit("Categoria criada", "Categoria", cat.id, `${cat.name} › ${cat.subcategory}`);
      }
      store.save();
    },
    deleteCategory(id) {
      const cat = store.state.categories.find((c) => c.id === id);
      if (!cat) throw new Error("Categoria não encontrada.");
      const usedTx = store.state.transactions.some((t) => t.category === cat.name && t.subcategory === cat.subcategory);
      const usedBudget = store.state.budgets.some((b) => b.category === cat.name);
      if (usedTx || usedBudget) throw new Error("Categoria em uso por lançamentos ou orçamento não pode ser excluída.");
      store.state.categories = store.state.categories.filter((c) => c.id !== id);
      store.addAudit("Categoria excluída", "Categoria", id, `${cat.name} › ${cat.subcategory}`);
      store.save();
    },

    saveCostCenter(data, id) {
      if (!data.name || !String(data.name).trim()) throw new Error("Informe o nome do centro de custo.");
      if (id) {
        const cc = store.state.costCenters.find((c) => c.id === id);
        if (!cc) throw new Error("Centro de custo não encontrado.");
        const oldName = cc.name;
        Object.assign(cc, { name: String(data.name).trim(), owner: data.owner || "", monthlyBudget: round2(data.monthlyBudget), note: data.note || "" });
        if (oldName !== cc.name) {
          store.state.transactions.forEach((t) => { if (t.costCenter === oldName) t.costCenter = cc.name; });
          store.state.budgets.forEach((b) => { if (b.costCenter === oldName) b.costCenter = cc.name; });
        }
        store.addAudit("Centro de custo editado", "Centro de custo", cc.id, cc.name);
      } else {
        const cc = {
          id: store.nextId(store.state.costCenters, "CC", 3),
          name: String(data.name).trim(), owner: data.owner || "",
          monthlyBudget: round2(data.monthlyBudget), note: data.note || "",
        };
        store.state.costCenters.push(cc);
        store.addAudit("Centro de custo criado", "Centro de custo", cc.id, cc.name);
      }
      store.save();
    },
    deleteCostCenter(id) {
      const cc = store.state.costCenters.find((c) => c.id === id);
      if (!cc) throw new Error("Centro de custo não encontrado.");
      const used = store.state.transactions.some((t) => t.costCenter === cc.name) || store.state.budgets.some((b) => b.costCenter === cc.name);
      if (used) throw new Error("Centro de custo em uso não pode ser excluído.");
      store.state.costCenters = store.state.costCenters.filter((c) => c.id !== id);
      store.addAudit("Centro de custo excluído", "Centro de custo", id, cc.name);
      store.save();
    },

    saveBudget(data, id) {
      const cat = store.state.categories.find((c) => c.name === data.category && c.type === "Despesa");
      if (!cat) throw new Error("Selecione uma categoria de despesa válida.");
      if (!/^\d{4}-\d{2}$/.test(data.month || "")) throw new Error("Informe o mês do orçamento.");
      const planned = round2(data.planned);
      if (planned < 0) throw new Error("O orçamento não pode ser negativo.");
      const dup = store.state.budgets.find((b) => b.month === data.month && b.category === data.category && (b.costCenter || "") === (data.costCenter || "") && b.id !== id);
      if (dup) throw new Error("Já existe um orçamento para esta categoria e centro de custo neste mês.");
      if (id) {
        const b = store.state.budgets.find((x) => x.id === id);
        if (!b) throw new Error("Orçamento não encontrado.");
        Object.assign(b, { month: data.month, category: data.category, costCenter: data.costCenter || "", planned });
        store.addAudit("Orçamento editado", "Orçamento", b.id, `${b.category} — ${money(b.planned)}`);
      } else {
        const b = {
          id: store.nextId(store.state.budgets, "BGT", 3),
          month: data.month, category: data.category, costCenter: data.costCenter || "", planned,
        };
        store.state.budgets.push(b);
        store.addAudit("Orçamento criado", "Orçamento", b.id, `${b.category} — ${money(b.planned)}`);
      }
      store.save();
    },
    deleteBudget(id) {
      const b = store.state.budgets.find((x) => x.id === id);
      if (!b) return;
      store.state.budgets = store.state.budgets.filter((x) => x.id !== id);
      store.addAudit("Orçamento excluído", "Orçamento", id, `${b.category} — ${monthLabel(b.month)}`);
      store.save();
    },
    copyBudgets(fromMonth, toMonth) {
      if (!fromMonth || !toMonth || fromMonth === toMonth) throw new Error("Selecione meses diferentes.");
      const source = store.state.budgets.filter((b) => b.month === fromMonth);
      if (!source.length) throw new Error("Não há orçamento no mês de origem.");
      let created = 0;
      source.forEach((b) => {
        const dup = store.state.budgets.find((x) => x.month === toMonth && x.category === b.category && (x.costCenter || "") === (b.costCenter || ""));
        if (dup) return;
        store.state.budgets.push({ id: store.nextId(store.state.budgets, "BGT", 3), month: toMonth, category: b.category, costCenter: b.costCenter, planned: b.planned });
        created += 1;
      });
      if (created) {
        store.addAudit("Orçamento copiado", "Orçamento", "—", `${monthLabel(fromMonth)} → ${monthLabel(toMonth)} (${created} itens)`);
        store.save();
      }
      return created;
    },

    saveReconciliation(data, id) {
      if (!data.date) throw new Error("Informe a data.");
      if (!data.account) throw new Error("Selecione a conta.");
      if (!data.description || !String(data.description).trim()) throw new Error("Informe a descrição do extrato.");
      if (id) {
        const r = store.state.reconciliations.find((x) => x.id === id);
        if (!r) throw new Error("Item não encontrado.");
        Object.assign(r, {
          date: data.date, account: data.account, description: String(data.description).trim(),
          statementAmount: round2(data.statementAmount), systemAmount: round2(data.systemAmount),
          reconciled: !!data.reconciled, note: data.note || "",
        });
        store.addAudit("Conciliação editada", "Conciliação", r.id, r.description);
      } else {
        const r = {
          id: store.nextId(store.state.reconciliations, "REC", 3),
          date: data.date, account: data.account, description: String(data.description).trim(),
          statementAmount: round2(data.statementAmount), systemAmount: round2(data.systemAmount),
          reconciled: !!data.reconciled, note: data.note || "",
        };
        store.state.reconciliations.push(r);
        store.addAudit("Conciliação criada", "Conciliação", r.id, r.description);
      }
      store.save();
    },
    toggleReconciliation(id) {
      const r = store.state.reconciliations.find((x) => x.id === id);
      if (!r) return;
      r.reconciled = !r.reconciled;
      store.addAudit(r.reconciled ? "Item conciliado" : "Conciliação reaberta", "Conciliação", r.id, r.description);
      store.save();
    },
    deleteReconciliation(id) {
      const r = store.state.reconciliations.find((x) => x.id === id);
      if (!r) return;
      store.state.reconciliations = store.state.reconciliations.filter((x) => x.id !== id);
      store.addAudit("Conciliação excluída", "Conciliação", id, r.description);
      store.save();
    },

    createInstallmentGroup(data) {
      const count = Math.floor(num(data.count));
      const total = round2(data.total);
      if (!(total > 0)) throw new Error("Informe o valor total do parcelamento.");
      if (!(count >= 2 && count <= 60)) throw new Error("A quantidade de parcelas deve estar entre 2 e 60.");
      if (!data.firstDue) throw new Error("Informe o primeiro vencimento.");
      const type = data.type === "receita" ? "receita" : "despesa";
      requireCategory(data.category, data.subcategory, type);
      if (!data.account || !calc.accountById(data.account)) throw new Error("Selecione a conta.");
      const groupId = store.nextId(store.state.installmentGroups, "PRC", 4);
      const base = Math.floor((total / count) * 100) / 100;
      let accumulated = 0;
      for (let i = 1; i <= count; i++) {
        const amount = i === count ? round2(total - accumulated) : base;
        accumulated = round2(accumulated + amount);
        store.state.transactions.unshift({
          id: store.nextId(store.state.transactions, "LAN", 4),
          type,
          description: `${String(data.description || "Parcelamento").trim()} (${i}/${count})`,
          category: data.category, subcategory: data.subcategory,
          account: data.account, costCenter: data.costCenter || "",
          amount, date: data.date || todayISO(), dueDate: addMonthsISO(data.firstDue, i - 1),
          paidDate: null, status: "Previsto", method: data.method || "Boleto",
          note: data.note || "", document: "",
          payments: [], groupId,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cancelled: false,
        });
      }
      store.state.installmentGroups.unshift({
        id: groupId, description: String(data.description || "Parcelamento").trim(), type,
        totalAmount: total, count, category: data.category, subcategory: data.subcategory,
        account: data.account, costCenter: data.costCenter || "", method: data.method || "Boleto",
        firstDue: data.firstDue, createdAt: new Date().toISOString(), cancelled: false,
      });
      store.addAudit("Parcelamento criado", "Parcelamento", groupId, `${data.description} — ${count}x de ${money(base)}`);
      store.save();
      return groupId;
    },
    cancelInstallmentGroup(id, reason) {
      const g = store.state.installmentGroups.find((x) => x.id === id);
      if (!g) throw new Error("Parcelamento não encontrado.");
      const txs = calc.groupInstallments(id).filter((t) => calc.isOpen(t));
      if (!txs.length) throw new Error("Não há parcelas em aberto para cancelar.");
      txs.forEach((t) => {
        t.cancelled = true;
        t.status = "Cancelado";
        t.cancelledAt = new Date().toISOString();
        t.cancelReason = reason || "Parcelamento cancelado";
      });
      g.cancelled = true;
      store.addAudit("Parcelamento cancelado", "Parcelamento", id, `${txs.length} parcela(s) em aberto — ${reason || "sem motivo informado"}`);
      store.save();
      return txs.length;
    },

    updateOrg(name) {
      store.state.meta.org = String(name || "").trim() || "Luvis Finance";
      store.addAudit("Organização atualizada", "Sistema", "—", store.state.meta.org);
      store.save();
    },
    updateLists(kind, list) {
      if (!Array.isArray(list)) return;
      store.state.settings[kind] = list.filter((x) => String(x).trim()).map((x) => String(x).trim());
      store.save();
    },
  };

  FM.views = FM.views || {};
  FM.utils = U;
  FM.store = store;
  FM.calc = calc;
  FM.actions = actions;
})();

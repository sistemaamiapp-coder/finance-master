/* =========================================================
   MEU LAR FINANCEIRO — store, cálculos e regras de negócio
   ========================================================= */
(function () {
  "use strict";
  const FM = (window.FM = window.FM || {});
  const KEY = "meu_lar_financeiro.v3";
  const LEGACY_KEY = "livis_finance.v2";
  const UI_KEY = "meu_lar_financeiro.ui.v3";
  const LEGACY_UI_KEY = "livis_finance.ui.v2";
  const VERSION = 3;
  const PRODUCT_NAME = "Meu Lar Financeiro";

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
    const cell = (value) => {
      const text = String(value == null ? "" : value);
      const numeric = typeof value === "number"
        ? Number.isFinite(value)
        : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text);
      const safe = !numeric && /^\s*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
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
    methods: ["Débito", "Crédito 1", "Crédito 2", "Crédito 3", "Crédito 4", "PIX", "Dinheiro", "Boleto", "Transferência"],
    periodicities: ["Única", "Semanal", "Mensal", "Anual"],
    types: ["Receita", "Despesa"],
    statuses: ["Previsto", "Pago", "Recebido", "Parcial", "Atrasado", "Em fatura", "Cancelado"],
    sections: ["Contas fixas", "Gastos do mês", "Cartão de crédito", "Entradas", "Investimento"],
    theme: "light",
    notifications: { dueDays: 7, budgetWarning: 80, budgetCritical: 100, goalInactivityDays: 30 },
  };

  const CATEGORY_DEFS = [
    ["Mercado", "Alimentos, bebidas, itens de limpeza da casa etc. comprados no mercado."],
    ["Necessidades", "Itens de farmácia, de higiene pessoal ou da casa."],
    ["Eletrônicos", "Computador, celular, notebook, conserto de eletrônicos e relógio."],
    ["Assinaturas", "Assinaturas como Prime, Netflix e Google+."],
    ["Roupa", "Roupas, calçados e qualquer tipo de vestimenta."],
    ["Beleza", "Maquiagem, manicure, salão e cremes específicos para o cabelo."],
    ["Presentes", "Presentes para amigos, familiares e namorados ou namoradas."],
    ["Saúde", "Suplementos, academia e consultas ao médico."],
    ["Despesas eventuais", "Consultas não planejadas, veterinários, conserto do carro e imprevistos."],
    ["Desenvolvimento", "Cursos, livros, planners e desenvolvimento pessoal."],
    ["Uber/transporte", "Uber, transporte e gasolina."],
    ["IFood/restaurante", "Restaurantes e comidas de delivery."],
    ["Lazer", "Festas, cinema, teatro, aniversários e apresentações."],
    ["Aluguel", "Custos com moradia."],
    ["Contas", "Internet, água, luz, condomínio, IPTU e outras contas."],
  ];

  function seedState() {
    const now = new Date().toISOString();
    const categories = [
      { id: "CAT-01", name: "Receitas", subcategory: "Entradas", type: "Receita", description: "Rendas e entradas mensais." },
      ...CATEGORY_DEFS.map((c, i) => ({ id: `CAT-${pad(i + 2)}`, name: c[0], subcategory: "Geral", type: "Despesa", description: c[1] })),
      { id: "CAT-17", name: "Não classificado", subcategory: "Revisar", type: "Despesa", description: "Categoria não informada na planilha; revise quando souber o destino do valor." },
    ];
    const accounts = [
      { id: "ACC-001", name: "Conta principal", institution: "Banco", type: "Conta corrente", openingBalance: 0, active: true },
      { id: "ACC-002", name: "Crédito 1", institution: "Cartão", type: "Cartão de crédito", openingBalance: 0, active: true },
      { id: "ACC-003", name: "Crédito 2", institution: "Cartão", type: "Cartão de crédito", openingBalance: 0, active: true },
      { id: "ACC-004", name: "Crédito 3", institution: "Cartão", type: "Cartão de crédito", openingBalance: 0, active: true },
      { id: "ACC-005", name: "Crédito 4", institution: "Cartão", type: "Cartão de crédito", openingBalance: 0, active: true },
      { id: "ACC-006", name: "Reserva", institution: "Investimento", type: "Investimento", openingBalance: 0, active: true },
      { id: "ACC-007", name: "Renda fixa", institution: "Investimento", type: "Investimento", openingBalance: 0, active: true },
    ];
    const costCenters = [
      { id: "CC-001", name: "Casa", owner: "Pessoal", monthlyBudget: 0, note: "Moradia e despesas do mês" },
      { id: "CC-002", name: "Pessoal", owner: "Pessoal", monthlyBudget: 0, note: "Entradas e gastos pessoais" },
      { id: "CC-003", name: "Cartões", owner: "Pessoal", monthlyBudget: 0, note: "Compras registradas nos cartões" },
    ];

    const sheets = [
      {
        label: "Outubro", month: "2026-10",
        fixed: [
          ["Luz", 355], ["Agua", 131], ["Tim", 200], ["Escola + Ballet", 60], ["DAS", 180], ["Regras", 270],
        ],
        variable: [
          ["Combustivel 4", 450], ["Aluguel 1", 300], ["Aluguel 2", 300], ["Aluguel 3", 300],
          ["Compras", 1000], ["Thayna", 300], ["Tamires Ultima", 300], ["Rematricula", 180],
          ["Maristela", 200], ["Formatura", 150], ["IPTV", 30],
        ],
        cards: [],
        income: [{ day: 28, description: "Entrada", amount: 2000 }],
      },
      {
        label: "Novembro", month: "2026-11",
        fixed: [
          ["Aluguel", 2000, "Saúde"], ["Luz", 500], ["Agua", 150], ["Tim", 200], ["Internet", 120],
          ["Escola + Ballet", 340], ["DAS", 180], ["10% dizimo", 1000],
        ],
        variable: [
          ["Combustivel 1", 450], ["Combustivel 2", 450], ["Combustivel 3", 450], ["Combustivel 4", 450],
          ["Aluguel 1", 300], ["Aluguel 2", 300], ["Aluguel 3", 300], ["Compras", 1000],
          ["Ingressos + Apresentação", 195], ["Emprestimo 1/60", 318], ["Ipva atrasado 1/3", 650], ["Formatura 2/2", 300],
        ],
        cards: [
          ["Atacadão", 400, "Crédito 1", "Cartão de Assinaturas"],
          ["Carrefour", 800, "Crédito 2", "Compras Grandes"],
          ["Nubank", 250, "Débito", ""],
        ],
        income: [
          { day: 4, description: "Entrada", amount: 2000 }, { day: 11, description: "Entrada", amount: 2000 },
          { day: 18, description: "Entrada", amount: 2000 }, { day: 25, description: "Entrada", amount: 2000 },
          { day: 2, description: "Entrada", amount: 2000 }, { day: null, description: "Vô", amount: 800 },
        ],
      },
      {
        label: "Dezembro", month: "2026-12",
        fixed: [
          ["Aluguel", 2000, "Saúde"], ["Luz", 500], ["Agua", 150], ["Tim", 200], ["Internet", 120],
          ["Escola + Ballet", 340], ["IPTV", 30], ["DAS", 180], ["10% dizimo", 760],
        ],
        variable: [
          ["Combustivel 1", 450], ["Combustivel 2", 450], ["Combustivel 3", 450], ["Combustivel 4", 450],
          ["Aluguel 1", 300], ["Aluguel 2", 300], ["Aluguel 3", 300], ["Compras", 1000],
          ["Ipva 3/3", 650], ["Empréstimo 2/60", 318],
        ],
        cards: [
          ["Atacadão", 400, "Crédito 1", "Cartão de Assinaturas"],
          ["Carrefour", 800, "Crédito 2", "Compras Grandes"],
          ["Nu", 250, "Crédito 1", ""],
        ],
        income: [
          { day: 9, description: "Entrada", amount: 2000 }, { day: 16, description: "Entrada", amount: 2000 },
          { day: 23, description: "Entrada", amount: 2000 }, { day: 30, description: "Entrada", amount: 1600 },
          { day: null, description: "Vô", amount: 800 }, { day: null, description: "Entrada sem descrição", amount: 900 },
        ],
      },
    ];

    const transactions = [];
    let seq = 0;
    const accountFor = (method) => {
      const match = String(method || "").match(/^Crédito ([1-4])$/);
      return match ? `ACC-00${Number(match[1]) + 1}` : "ACC-001";
    };
    const categoryFor = (description, explicit) => {
      if (explicit) return { name: explicit, inferred: false };
      const d = String(description || "").toLowerCase();
      if (/combustivel/.test(d)) return { name: "Uber/transporte", inferred: true };
      if (/aluguel/.test(d)) return { name: "Aluguel", inferred: true };
      if (/luz|agua|tim|internet|iptv|das/.test(d)) return { name: "Contas", inferred: true };
      if (/escola|ballet|rematricula/.test(d)) return { name: "Desenvolvimento", inferred: true };
      if (/formatura|ingressos|apresenta/.test(d)) return { name: "Lazer", inferred: true };
      if (/ipva/.test(d)) return { name: "Despesas eventuais", inferred: true };
      if (/atacad|carrefour/.test(d)) return { name: "Mercado", inferred: true };
      return { name: "Não classificado", inferred: false };
    };
    const groupFor = (description) => {
      if (/emprestimo|empréstimo/i.test(description)) return "PRC-0001";
      if (/ipva/i.test(description)) return "PRC-0002";
      return null;
    };
    const joinNotes = (parts) => parts.filter(Boolean).join(" · ");

    function addTx(o) {
      seq += 1;
      const id = `LAN-${String(seq).padStart(4, "0")}`;
      const settle = o.settle || null;
      const createdAt = new Date(Date.now() + seq).toISOString();
      const tx = {
        id,
        date: o.date,
        type: o.type,
        description: o.description,
        category: o.category,
        subcategory: o.subcategory,
        section: o.section,
        account: o.account,
        costCenter: o.costCenter || "",
        amount: round2(o.amount),
        dueDate: o.dueDate,
        paidDate: settle,
        status: settle ? (o.type === "receita" ? "Recebido" : "Pago") : "Previsto",
        method: o.method,
        note: o.note || "",
        document: o.sourceRef || "",
        payments: settle ? [{ id: `PG-${id}`, date: settle, amount: round2(o.amount), account: o.account, note: "" }] : [],
        groupId: o.groupId || null,
        sourceRef: o.sourceRef || "",
        createdAt,
        updatedAt: createdAt,
        cancelled: false,
      };
      transactions.push(tx);
      return tx;
    }

    sheets.forEach((sheet) => {
      const refDate = `${sheet.month}-01`;
      sheet.fixed.forEach(([description, amount, explicitCategory]) => {
        if (!(amount > 0)) return;
        const cat = categoryFor(description, explicitCategory);
        const notes = [
          cat.inferred ? "Categoria sugerida pelo sistema; não informada na planilha." : "",
          explicitCategory ? "Categoria mantida como Saúde, conforme a planilha." : "",
          "Vencimento não informado na planilha.",
        ];
        addTx({
          date: refDate, dueDate: null, type: "despesa", section: "Contas fixas", description,
          category: cat.name, subcategory: cat.name === "Receitas" ? "Entradas" : cat.name === "Não classificado" ? "Revisar" : "Geral",
          account: "ACC-001", costCenter: "Casa", amount, method: "Débito", settle: null,
          note: joinNotes(notes), sourceRef: `${sheet.label} · Contas fixas`,
        });
      });

      sheet.variable.forEach(([description, amount]) => {
        const cat = categoryFor(description);
        const notes = [
          cat.inferred ? "Categoria sugerida pelo sistema; não informada na planilha." : "",
          "Data de referência: primeiro dia do mês; o dia não foi informado.",
        ];
        addTx({
          date: refDate, dueDate: refDate, type: "despesa", section: "Gastos do mês", description,
          category: cat.name, subcategory: cat.name === "Não classificado" ? "Revisar" : "Geral",
          account: "ACC-001", costCenter: "Casa", amount, method: "Débito", settle: refDate,
          note: joinNotes(notes), sourceRef: `${sheet.label} · Gastos do mês`, groupId: groupFor(description),
        });
      });

      sheet.cards.forEach(([description, amount, method, detail]) => {
        const cat = categoryFor(description);
        const credit = /^Crédito [1-4]$/.test(method);
        const notes = [
          detail,
          cat.inferred ? "Categoria sugerida pelo sistema; não informada na planilha." : "",
          "Data de referência: primeiro dia do mês; o dia não foi informado.",
        ];
        addTx({
          date: refDate, dueDate: refDate, type: "despesa", section: credit ? "Cartão de crédito" : "Gastos do mês", description,
          category: cat.name, subcategory: cat.name === "Não classificado" ? "Revisar" : "Geral",
          account: credit ? accountFor(method) : "ACC-001", costCenter: credit ? "Cartões" : "Casa", amount, method, settle: null,
          note: joinNotes(notes), sourceRef: `${sheet.label} · Cartão`,
        });
      });

      sheet.income.forEach(({ day, description, amount }) => {
        const date = day ? `${sheet.month}-${pad(day)}` : refDate;
        const notes = [
          day ? "" : "Dia da entrada não informado na planilha; usado o primeiro dia como referência.",
          description === "Entrada sem descrição" ? "Descrição ausente na planilha." : "",
        ];
        addTx({
          date, dueDate: date, type: "receita", section: "Entradas", description,
          category: "Receitas", subcategory: "Entradas", account: "ACC-001", costCenter: "Pessoal",
          amount, method: "Débito", settle: date, note: joinNotes(notes), sourceRef: `${sheet.label} · Entradas`,
        });
      });
    });

    const totalFor = (groupId) => round2(transactions.filter((t) => t.groupId === groupId).reduce((sum, t) => sum + num(t.amount), 0));
    const installmentGroups = [
      {
        id: "PRC-0001", description: "Empréstimo", type: "despesa", totalAmount: totalFor("PRC-0001"), count: 60,
        recordedCount: 2, category: "Não classificado", subcategory: "Revisar", account: "ACC-001",
        costCenter: "Casa", method: "Débito", firstDue: "2026-11-01", createdAt: now, cancelled: false,
        note: "A planilha registra apenas as parcelas 1/60 e 2/60.",
      },
      {
        id: "PRC-0002", description: "IPVA", type: "despesa", totalAmount: totalFor("PRC-0002"), count: 3,
        recordedCount: 2, category: "Despesas eventuais", subcategory: "Geral", account: "ACC-001",
        costCenter: "Casa", method: "Débito", firstDue: "2026-11-01", createdAt: now, cancelled: false,
        note: "A planilha registra 1/3 e 3/3; a parcela 2/3 não aparece.",
      },
    ];

    return {
      version: VERSION,
      meta: { org: PRODUCT_NAME, source: "Contas 2026 Envios Extra.xlsx", defaultMonth: "2026-11", createdAt: now, updatedAt: now },
      accounts, categories, costCenters, transactions, transfers: [],
      budgets: [], reconciliations: [], installmentGroups,
      settings: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
      audit: [{ id: uid("AUD"), ts: now, action: "Planilha importada", entity: "Contas 2026", ref: "Outubro a dezembro", detail: "Valores válidos importados; categorias ausentes receberam sugestões e datas não informadas usaram referência mensal." }],
    };
  }

  function makeRevisionConflict() {
    const error = new Error("Os dados mudaram em outro dispositivo. Recarregue antes de salvar novamente.");
    error.status = 409;
    error.code = "REVISION_CONFLICT";
    return error;
  }

  /* ---------------- store ---------------- */
  const store = {
    state: null,
    ui: { month: monthKeyOf(todayISO()), txFilters: {} },
    _initDone: false,
    remote: false,
    allowLocalMigration: true,
    revision: 0,
    dirty: false,
    _saveQueue: Promise.resolve(),
    _saveGeneration: 0,

    async init() {
      let loaded = null;
      for (const key of [KEY, LEGACY_KEY]) {
        try {
          loaded = JSON.parse(localStorage.getItem(key) || "null");
        } catch (e) {
          loaded = null;
        }
        if (loaded && Array.isArray(loaded.transactions)) break;
      }
      if (!loaded || !Array.isArray(loaded.transactions)) loaded = seedState();
      try {
        const model = await import("../../backend/src/services/finance.js");
        loaded = model.normalizeState(loaded);
      } catch (error) {
        console.error("Falha ao normalizar os dados locais", error);
        loaded.version = VERSION;
        loaded.meta = Object.assign({ org: PRODUCT_NAME }, loaded.meta || {});
        loaded.meta.org = PRODUCT_NAME;
        loaded.settings = Object.assign({}, DEFAULT_LISTS, loaded.settings || {});
        loaded.settings.statuses = [...new Set([...DEFAULT_LISTS.statuses, ...(Array.isArray(loaded.settings.statuses) ? loaded.settings.statuses : [])])];
        ["goals", "shoppingLists", "recurring", "reminders", "donors"].forEach((key) => { if (!Array.isArray(loaded[key])) loaded[key] = []; });
      }
      this.state = loaded;
      if (FM.theme) FM.theme.apply(this.state.settings.theme, { persist: false });
      try {
        const ui = JSON.parse(localStorage.getItem(UI_KEY) || localStorage.getItem(LEGACY_UI_KEY) || "null");
        if (ui && /^\d{4}-\d{2}$/.test(ui.month || "")) this.ui.month = ui.month;
        else if (/^\d{4}-\d{2}$/.test(loaded.meta.defaultMonth || "")) this.ui.month = loaded.meta.defaultMonth;
      } catch (e) {}
      this.save({ silent: true });
      this._initDone = true;
    },

    hasLocalData() {
      for (const key of [KEY, LEGACY_KEY]) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "null");
          if (data && (data.accounts?.length || data.transactions?.length)) return true;
        } catch (e) {}
      }
      return false;
    },

    async loadRemote() {
      const workspace = await FM.api.getState();
      this.state = workspace.state;
      this.revision = workspace.revision;
      if (FM.theme) FM.theme.apply(this.state.settings.theme, { persist: false });
      this.remote = true;
      this.dirty = false;
      return workspace;
    },

    save(opts) {
      this.state.meta.updatedAt = new Date().toISOString();
      if (FM.theme) FM.theme.apply(this.state.settings.theme);
      if (!this.remote) {
        try {
          localStorage.setItem(KEY, JSON.stringify(this.state));
        } catch (e) {
          console.error("Falha ao salvar dados", e);
          if (FM.ui && FM.ui.toast) FM.ui.toast("Não foi possível salvar os dados neste navegador.", "error");
        }
        if (!opts || !opts.silent) {
          if (FM.app && FM.app.onDataChanged) FM.app.onDataChanged();
        }
        return Promise.resolve();
      }

      const snapshot = JSON.parse(JSON.stringify(this.state));
      const generation = this._saveGeneration;
      this.dirty = true;
      const task = this._saveQueue.then(async () => {
        if (generation !== this._saveGeneration) throw makeRevisionConflict();
        const workspace = await FM.api.saveState(snapshot, this.revision);
        this.revision = workspace.revision;
        this.dirty = false;
        return workspace;
      });
      this._saveQueue = task.catch(async (error) => {
        if (error.status === 409 || error.code === "REVISION_CONFLICT") {
          this._saveGeneration += 1;
          const workspace = await FM.api.getState();
          this.state = workspace.state;
          this.revision = workspace.revision;
          if (FM.theme) FM.theme.apply(this.state.settings.theme, { persist: false });
          this.dirty = false;
          if (FM.app && FM.app.onDataChanged) FM.app.onDataChanged();
        }
        if (FM.ui && FM.ui.toast) {
          FM.ui.toast(error.status === 409 ? "Os dados mudaram em outro dispositivo. A versão mais recente foi carregada." : "Não foi possível salvar no servidor. Suas alterações continuam nesta tela.", "error");
        }
      });
      if (!opts || !opts.silent) {
        if (FM.app && FM.app.onDataChanged) FM.app.onDataChanged();
      }
      return task;
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
      if (this.remote) return FM.api.downloadBackup();
      const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
      const name = `meu-lar-financeiro-backup-${todayISO()}.json`;
      downloadFile(blob, name);
      return Promise.resolve();
    },
    async importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Arquivo inválido: não é um JSON válido."); }
      data = data?.state || data;
      if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
        throw new Error("Backup inválido: estrutura não reconhecida.");
      }
      try {
        const model = await import("../../backend/src/services/finance.js");
        data = model.validateState(data);
      } catch (error) {
        if (error instanceof SyntaxError) throw error;
        throw new Error(`Backup inválido: ${error.message}`);
      }
      this.state = data;
      this.addAudit("Backup restaurado", "Sistema", "—", "Dados importados de arquivo JSON.");
      return this.save();
    },
    async restoreSheet() {
      const model = await import("../../backend/src/services/finance.js");
      this.state = model.normalizeState(seedState());
      return this.save();
    },
    async clearAll() {
      const model = await import("../../backend/src/services/finance.js");
      this.state = model.createEmptyState({ name: this.state.meta?.name, email: this.state.meta?.email });
      this.addAudit("Dados apagados", "Sistema", "—", "Todos os cadastros e lançamentos foram removidos.");
      return this.save();
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
    isCardPurchase(t) { return !!t && (t.section === "Cartão de crédito" || this.accountById(t.account)?.type === "Cartão de crédito"); },
    isOpen(t) { return t && !this.isCardPurchase(t) && !this.isCancelled(t) && this.remaining(t) > 0.004; },

    effectiveStatus(t) {
      if (!t) return "—";
      if (this.isCancelled(t)) return "Cancelado";
      if (this.isCardPurchase(t)) return "Em fatura";
      const rem = this.remaining(t);
      if (rem <= 0.004) return t.type === "receita" ? "Recebido" : "Pago";
      if (this.paidTotal(t) > 0.004) return "Parcial";
      if (t.dueDate && t.dueDate < todayISO()) return "Atrasado";
      return "Previsto";
    },
    statusTone(status) {
      return {
        "Pago": "ok", "Recebido": "ok", "Previsto": "primary", "Parcial": "warn",
        "Atrasado": "danger", "Em fatura": "purple", "Cancelado": "muted",
      }[status] || "muted";
    },

    isCashAccount(acc) {
      return !!acc && !["Cartão de crédito", "Cartão", "Investimento"].includes(acc.type);
    },
    invoiceMonthForDate(card, date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return "";
      const key = `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}`;
      return parsed.getUTCDate() <= (Number(card.closingDay) || 31) ? key : addMonthsKey(key, 1);
    },
    invoiceDueDate(card, key) {
      const dueDay = Math.min(31, Number(card.dueDay) || 31);
      const closingDay = Math.min(31, Number(card.closingDay) || 31);
      const target = dueDay <= closingDay ? addMonthsKey(key, 1) : key;
      return `${target}-${pad(Math.min(dueDay, Number(monthEnd(target).slice(8, 10))))}`;
    },
    cardInvoice(cardId, key) {
      const card = this.accountById(cardId);
      if (!card || card.type !== "Cartão de crédito") throw new Error("Cartão não encontrado.");
      const purchases = store.state.transactions.filter((tx) => !this.isCancelled(tx) && tx.account === cardId && tx.section === "Cartão de crédito" && (tx.invoiceMonth || this.invoiceMonthForDate(card, tx.date)) === key);
      const total = round2(purchases.reduce((sum, tx) => sum + num(tx.amount), 0));
      const paid = round2(store.state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth === key).reduce((sum, transfer) => sum + num(transfer.amount), 0));
      const balance = round2(Math.max(0, total - paid));
      return {
        cardId, month: key,
        closingDate: `${key}-${pad(Math.min(Number(card.closingDay) || 31, Number(monthEnd(key).slice(8, 10))))}`,
        dueDate: this.invoiceDueDate(card, key), total, paid, balance,
        status: paid + 0.004 >= total ? "Paga" : paid > 0 ? "Parcial" : key < monthKeyOf(todayISO()) ? "Vencida" : "Aberta",
        purchaseCount: purchases.length,
      };
    },
    cardSummary(cardId) {
      const card = this.accountById(cardId);
      const purchases = store.state.transactions.filter((tx) => !this.isCancelled(tx) && tx.account === cardId && tx.section === "Cartão de crédito").reduce((sum, tx) => sum + num(tx.amount), 0);
      const paid = store.state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth).reduce((sum, transfer) => sum + num(transfer.amount), 0);
      const used = round2(Math.max(0, purchases - paid));
      const total = num(card?.limit);
      return { total, used, available: round2(Math.max(0, total - used)) };
    },
    cardMonths(cardId) {
      const months = new Set([monthKeyOf(todayISO())]);
      store.state.transactions.filter((tx) => tx.account === cardId && tx.invoiceMonth).forEach((tx) => months.add(tx.invoiceMonth));
      store.state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth).forEach((transfer) => months.add(transfer.invoiceMonth));
      return [...months].sort().reverse();
    },
    cardPurchases(cardId) {
      const groups = new Map();
      store.state.transactions.filter((tx) => tx.account === cardId && tx.section === "Cartão de crédito").forEach((tx) => {
        const id = tx.cardPurchaseId || tx.id;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(tx);
      });
      return [...groups.values()].map((items) => items.sort((a, b) => a.installmentNumber - b.installmentNumber)).sort((a, b) => (b[0].purchaseDate || b[0].date).localeCompare(a[0].purchaseDate || a[0].date));
    },
    investmentBalance(untilISO) {
      return round2(store.state.accounts
        .filter((a) => a.type === "Investimento")
        .reduce((s, a) => s + this.accountBalance(a.id, untilISO), 0));
    },
    accountBalance(accountId, untilISO) {
      const acc = this.accountById(accountId);
      if (!acc) return 0;
      const cutoff = untilISO || todayISO();
      let bal = num(acc.openingBalance);
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t)) return;
        if (acc.type === "Cartão de crédito" && t.account === accountId && t.section === "Cartão de crédito" && !(t.payments || []).length && t.date <= cutoff) {
          bal -= num(t.amount);
        }
        (t.payments || []).forEach((p) => {
          if ((p.account || t.account) !== accountId) return;
          if (p.date > cutoff) return;
          bal += t.type === "receita" ? num(p.amount) : -num(p.amount);
        });
      });
      store.state.transfers.forEach((tr) => {
        if (tr.date > cutoff) return;
        if (tr.fromAccount === accountId) bal -= num(tr.amount);
        if (tr.toAccount === accountId) bal += num(tr.amount);
      });
      return round2(bal);
    },
    consolidatedBalance(untilISO) {
      return round2(store.state.accounts
        .filter((a) => this.isCashAccount(a))
        .reduce((s, a) => s + this.accountBalance(a.id, untilISO), 0));
    },

    paymentsInMonth(filter) {
      const out = [];
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t)) return;
        if (filter && filter.type && t.type !== filter.type) return;
        (t.payments || []).forEach((p) => {
          if (filter && filter.month && monthKeyOf(p.date) !== filter.month) return;
          if (filter && filter.cashOnly && !this.isCashAccount(this.accountById(p.account || t.account))) return;
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
      this.paymentsInMonth({ month: key, cashOnly: true }).forEach(({ tx, payment }) => {
        if (tx.type === "receita") receitasRecebidas += num(payment.amount);
        else despesasPagas += num(payment.amount);
      });
      let entradasPrevistas = 0;
      let saidasPrevistas = 0;
      let countReceber = 0;
      let countPagar = 0;
      store.state.transactions.forEach((t) => {
        if (!this.isOpen(t) || !this.isCashAccount(this.accountById(t.account))) return;
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
    monthPlan(key) {
      let receitas = 0, despesas = 0, fixas = 0, variaveis = 0, cartao = 0;
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t) || monthKeyOf(t.date) !== key) return;
        const amount = num(t.amount);
        if (t.type === "receita") {
          receitas += amount;
          return;
        }
        despesas += amount;
        if (t.section === "Contas fixas") fixas += amount;
        else if (t.section === "Cartão de crédito") cartao += amount;
        else variaveis += amount;
      });
      const investimentos = store.state.transfers
        .filter((tr) => monthKeyOf(tr.date) === key)
        .filter((tr) => {
          const acc = this.accountById(tr.toAccount);
          return acc && acc.type === "Investimento";
        })
        .reduce((sum, tr) => sum + num(tr.amount), 0);
      return {
        receitas: round2(receitas), despesas: round2(despesas), saldo: round2(receitas - despesas),
        fixas: round2(fixas), variaveis: round2(variaveis), cartao: round2(cartao), investimentos: round2(investimentos),
      };
    },
    monthlySeries(keys) {
      return (keys || []).map((k) => Object.assign(this.monthStats(k), { label: monthLabel(k, "short") }));
    },
    categoryPlan(key, type) {
      const map = new Map();
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t) || monthKeyOf(t.date) !== key) return;
        if (type && t.type !== type) return;
        const name = t.category || "Sem categoria";
        const cur = map.get(name) || { name, total: 0, count: 0 };
        cur.total += num(t.amount);
        cur.count += 1;
        map.set(name, cur);
      });
      return Array.from(map.values()).map((x) => Object.assign(x, { total: round2(x.total) })).sort((a, b) => b.total - a.total);
    },
    paymentMethodTotals(key) {
      const map = new Map();
      store.state.transactions.forEach((t) => {
        if (this.isCancelled(t) || t.type !== "despesa" || monthKeyOf(t.date) !== key) return;
        const name = t.method || "Não informado";
        const cur = map.get(name) || { name, total: 0, count: 0 };
        cur.total += num(t.amount);
        cur.count += 1;
        map.set(name, cur);
      });
      return Array.from(map.values()).map((x) => Object.assign(x, { total: round2(x.total) })).sort((a, b) => b.total - a.total);
    },
    categorySpend(key, type) {
      const map = new Map();
      this.paymentsInMonth({ month: key, type: type || "despesa", cashOnly: true }).forEach(({ tx, payment }) => {
        const k = tx.category || "Sem categoria";
        const cur = map.get(k) || { name: k, total: 0, count: 0 };
        cur.total += num(payment.amount);
        cur.count += 1;
        map.set(k, cur);
      });
      return Array.from(map.values()).map((x) => Object.assign(x, { total: round2(x.total) })).sort((a, b) => b.total - a.total);
    },
    categoryIncome(key) { return this.categorySpend(key, "receita"); },

    notificationSettings() {
      const value = store.state.settings.notifications || {};
      const dueDays = Math.min(60, Math.max(1, Math.round(num(value.dueDays) || 7)));
      const budgetWarning = Math.min(99, Math.max(50, Math.round(num(value.budgetWarning) || 80)));
      const budgetCritical = Math.min(200, Math.max(budgetWarning + 1, Math.round(num(value.budgetCritical) || 100)));
      const goalInactivityDays = Math.min(365, Math.max(1, Math.round(num(value.goalInactivityDays) || 30)));
      return { dueDays, budgetWarning, budgetCritical, goalInactivityDays };
    },

    openTotals(type) {
      let total = 0, count = 0, overdueTotal = 0, overdueCount = 0, soonTotal = 0, soonCount = 0;
      const today = todayISO();
      const dueDays = this.notificationSettings().dueDays;
      store.state.transactions.forEach((t) => {
        if (t.type !== type || !this.isOpen(t)) return;
        const rem = this.remaining(t);
        total += rem; count += 1;
        if (t.dueDate && t.dueDate < today) { overdueTotal += rem; overdueCount += 1; }
        else if (t.dueDate && dayDiff(t.dueDate) <= dueDays) { soonTotal += rem; soonCount += 1; }
      });
      return { total: round2(total), count, overdue: { total: round2(overdueTotal), count: overdueCount }, soon: { total: round2(soonTotal), count: soonCount } };
    },

    budgetRows(key) {
      const rows = [];
      const monthPayments = this.paymentsInMonth({ month: key, type: "despesa" });
      const notifications = this.notificationSettings();
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
        rows.push({
          budget: b, category: b.category, costCenter: b.costCenter, planned, actual,
          remaining: round2(planned - actual), usage, over: actual > planned + 0.004,
          warning: planned > 0 && usage >= notifications.budgetWarning / 100,
          critical: planned > 0 && usage >= notifications.budgetCritical / 100,
        });
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
      const budgets = this.budgetRows(store.ui.month).filter((r) => r.warning);
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
          title: `${pay.soon.count} conta(s) vencem em até ${this.notificationSettings().dueDays} dias`,
          text: `${money(pay.soon.total)} a pagar nos próximos dias. Confirme o saldo da conta escolhida antes da baixa.`,
          link: { route: "a-pagar", label: "Planejar pagamentos" },
        });
      }

      const budgetRows = this.budgetRows(key);
      const worst = budgetRows.filter((r) => r.planned > 0).sort((a, b) => b.usage - a.usage)[0];
      if (worst && worst.warning) {
        out.push({
          tone: worst.critical || worst.over ? "danger" : "warn", icon: "target",
          title: `Orçamento de ${worst.category} em ${pct(worst.usage)}`,
          text: worst.over
            ? `O realizado (${money(worst.actual)}) já superou o planejado (${money(worst.planned)}) em ${money(Math.abs(worst.remaining))}. Reveja a categoria ou ajuste o plano.`
            : `Já foram usados ${money(worst.actual)} de ${money(worst.planned)}. Restam ${money(worst.remaining)} até o fim do mês.`,
          link: { route: "orcamento", label: "Ajustar orçamento" },
        });
      }

      const inactivityDays = this.notificationSettings().goalInactivityDays;
      const inactiveGoal = store.state.goals
        .filter((goal) => goal.status === "active")
        .map((goal) => {
          const lastActivity = (goal.movements || []).reduce((latest, movement) => movement.date > latest ? movement.date : latest, goal.startDate || "");
          return { goal, lastActivity, inactiveFor: lastActivity ? dayDiff(lastActivity) : 0 };
        })
        .filter((item) => item.inactiveFor >= inactivityDays)
        .sort((a, b) => b.inactiveFor - a.inactiveFor)[0];
      if (inactiveGoal) {
        out.push({
          tone: "warn", icon: "clock",
          title: `Meta ${inactiveGoal.goal.name} está sem movimentação`,
          text: `Faz ${inactiveGoal.inactiveFor} dia(s) desde o último movimento. Revise o valor e a data prevista para manter o plano atualizado.`,
          link: { route: "metas", label: "Revisar metas" },
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
  function goalBalance(goal) {
    const movements = (goal.movements || []).reduce((total, movement) => total + (movement.type === "retirada" ? -num(movement.amount) : num(movement.amount)), num(goal.initialAmount));
    return round2(movements);
  }
  function requireCashAccount(id, label) {
    const account = calc.accountById(id);
    if (!account || !account.active || !calc.isCashAccount(account)) throw new Error(`Selecione uma ${label} válida e ativa.`);
    return account;
  }
  function createGoalTransfer(goal, counterpartAccount, type, amount, date, note, id) {
    const transfer = {
      id,
      date,
      fromAccount: type === "deposito" ? counterpartAccount : goal.account,
      toAccount: type === "deposito" ? goal.account : counterpartAccount,
      amount,
      fee: 0,
      note: `Meta ${goal.name} · ${note}`,
    };
    store.state.transfers.unshift(transfer);
    return transfer;
  }
  function expenseCategory(name) {
    return store.state.categories.find((category) => category.type === "Despesa" && category.name === name) || null;
  }
  function requireExpenseCategory(name) {
    const category = expenseCategory(name);
    if (!category) throw new Error("Selecione uma categoria de despesa válida.");
    return category;
  }
  function assertShoppingEditable(list) {
    if (list.generatedTxIds?.length) throw new Error("Esta lista já gerou despesa e seus itens estão bloqueados para preservar o histórico.");
  }
  async function commitValidated(change, audit) {
    const model = await import("../../backend/src/services/finance.js");
    const candidate = JSON.parse(JSON.stringify(store.state));
    const result = change(candidate);
    if (audit) candidate.audit.unshift({ id: uid("AUD"), ts: new Date().toISOString(), action: audit.action, entity: audit.entity, ref: audit.ref, detail: audit.detail });
    store.state = model.validateState(candidate);
    await store.save();
    return result;
  }

  const actions = {
    saveGoal(data, id) {
      const existing = id ? store.state.goals.find((goal) => goal.id === id) : null;
      if (id && !existing) throw new Error("Meta não encontrada.");
      const account = calc.accountById(existing ? existing.account : data.account);
      if (!account || !account.active || account.type !== "Investimento") throw new Error("Selecione uma conta de investimento ativa.");
      const name = String(data.name || "").trim();
      if (!name) throw new Error("Informe o nome da meta.");
      const target = round2(data.target);
      if (!(target > 0)) throw new Error("Informe um valor desejado maior que zero.");
      const startDate = existing ? existing.startDate : data.startDate;
      const targetDate = data.targetDate || null;
      if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Informe a data de início.");
      if (targetDate && targetDate < startDate) throw new Error("A data prevista não pode ser anterior ao início.");
      const status = ["active", "paused", "concluded", "cancelled"].includes(data.status) ? data.status : "active";

      if (existing) {
        if (data.account && data.account !== existing.account) throw new Error("A conta de investimento não pode mudar depois da criação.");
        if (Math.abs(round2(data.initialAmount) - num(existing.initialAmount)) > 0.004) {
          throw new Error("O valor inicial não pode ser alterado. Use um movimento para ajustar a reserva.");
        }
        if (status === "concluded" && goalBalance(existing) <= 0) throw new Error("Uma meta sem saldo não pode ser marcada como concluída.");
        if (data.allowNegative !== true && goalBalance(existing) < 0) throw new Error("A meta está negativa. Mantenha a regra de saldo negativo ou ajuste a reserva primeiro.");
        Object.assign(existing, { name, target, targetDate, description: String(data.description || "").trim(), allowNegative: data.allowNegative === true, status, updatedAt: new Date().toISOString() });
        store.addAudit("Meta editada", "Meta", existing.id, name);
        return store.save();
      }

      const initialAmount = round2(data.initialAmount);
      if (initialAmount < 0) throw new Error("O valor inicial não pode ser negativo.");
      if (status === "concluded" && initialAmount <= 0) throw new Error("Uma meta sem saldo não pode ser marcada como concluída.");
      let initialAccount = null;
      if (initialAmount > 0) {
        initialAccount = requireCashAccount(data.initialAccount, "conta de origem");
        if (calc.accountBalance(initialAccount.id, startDate) + 0.004 < initialAmount) throw new Error("A conta de origem não possui saldo suficiente para o valor inicial.");
      }
      const goal = {
        id: store.nextId(store.state.goals, "META", 3),
        name, target, initialAmount, startDate, targetDate,
        description: String(data.description || "").trim(),
        account: account.id, initialAccount: initialAccount?.id || null, status, allowNegative: data.allowNegative === true,
        movements: [], initialTransferId: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      store.state.goals.unshift(goal);
      if (initialAmount > 0) {
        const transfer = createGoalTransfer(goal, initialAccount.id, "deposito", initialAmount, startDate, "valor inicial", store.nextId(store.state.transfers, "TR", 3));
        goal.initialTransferId = transfer.id;
      }
      store.addAudit("Meta criada", "Meta", goal.id, `${name} — objetivo ${money(target)}`);
      return store.save();
    },

    addGoalMovement(goalId, data) {
      const goal = store.state.goals.find((item) => item.id === goalId);
      if (!goal) throw new Error("Meta não encontrada.");
      if (goal.status !== "active") throw new Error("Retome a meta antes de registrar movimentos.");
      const type = data.type === "retirada" ? "retirada" : "deposito";
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Informe a data do movimento.");
      if (data.date < goal.startDate) throw new Error("O movimento não pode ser anterior ao início da meta.");
      const counterpart = requireCashAccount(data.counterpartAccount, type === "deposito" ? "conta de origem" : "conta de destino");
      const sourceId = type === "deposito" ? counterpart.id : goal.account;
      if (calc.accountBalance(sourceId, data.date) + 0.004 < amount) throw new Error("A conta de origem não possui saldo suficiente.");
      const nextBalance = round2(goalBalance(goal) + (type === "deposito" ? amount : -amount));
      if (nextBalance < 0 && !goal.allowNegative) throw new Error("A retirada deixaria a meta negativa. Altere a regra da meta ou use um valor menor.");
      if (nextBalance < 0 && data.confirmNegative !== true) throw new Error("Confirme a retirada que deixará o saldo da meta negativo.");
      const transfer = createGoalTransfer(goal, counterpart.id, type, amount, data.date, data.note || (type === "deposito" ? "depósito" : "retirada"), store.nextId(store.state.transfers, "TR", 3));
      const movement = {
        id: store.nextId(goal.movements, "MOV", 3), type, amount, date: data.date,
        counterpartAccount: counterpart.id, note: String(data.note || "").trim(), transferId: transfer.id,
        createdAt: new Date().toISOString(),
      };
      goal.movements.unshift(movement);
      goal.updatedAt = new Date().toISOString();
      store.addAudit(type === "deposito" ? "Depósito na meta" : "Retirada da meta", "Meta", goal.id, `${goal.name} — ${money(amount)} em ${fmtDate(data.date)}`);
      return store.save();
    },

    reverseGoalMovement(goalId, movementId) {
      const goal = store.state.goals.find((item) => item.id === goalId);
      const movement = goal?.movements?.find((item) => item.id === movementId);
      if (!goal || !movement) throw new Error("Movimento não encontrado.");
      if (movement.reversalOf) throw new Error("Um movimento de estorno não pode ser estornado novamente.");
      if (goal.movements.some((item) => item.reversalOf === movement.id)) throw new Error("Este movimento já foi estornado.");
      const type = movement.type === "deposito" ? "retirada" : "deposito";
      const counterpart = requireCashAccount(movement.counterpartAccount, "conta da operação");
      const sourceId = type === "deposito" ? counterpart.id : goal.account;
      if (calc.accountBalance(sourceId, movement.date) + 0.004 < movement.amount) throw new Error("A conta de origem não possui saldo suficiente para o estorno.");
      const nextBalance = round2(goalBalance(goal) + (type === "deposito" ? movement.amount : -movement.amount));
      if (nextBalance < 0 && !goal.allowNegative) throw new Error("O estorno deixaria a meta negativa.");
      const transfer = createGoalTransfer(goal, counterpart.id, type, movement.amount, movement.date, `estorno de ${movement.id}`, store.nextId(store.state.transfers, "TR", 3));
      goal.movements.unshift({
        id: store.nextId(goal.movements, "MOV", 3), type, amount: movement.amount, date: movement.date,
        counterpartAccount: counterpart.id, note: `Estorno de ${movement.id}`, transferId: transfer.id,
        reversalOf: movement.id, createdAt: new Date().toISOString(),
      });
      goal.updatedAt = new Date().toISOString();
      store.addAudit("Movimento de meta estornado", "Meta", goal.id, `${movement.id} — ${money(movement.amount)}`);
      return store.save();
    },

    setGoalStatus(id, status) {
      const goal = store.state.goals.find((item) => item.id === id);
      if (!goal) throw new Error("Meta não encontrada.");
      if (!["active", "paused", "concluded", "cancelled"].includes(status)) throw new Error("Status inválido.");
      if (status === "concluded" && goalBalance(goal) <= 0) throw new Error("Uma meta sem saldo não pode ser marcada como concluída.");
      goal.status = status;
      goal.updatedAt = new Date().toISOString();
      store.addAudit("Status da meta alterado", "Meta", goal.id, `${goal.name} — ${status}`);
      return store.save();
    },

    saveShoppingList(data, id) {
      const existing = id ? store.state.shoppingLists.find((list) => list.id === id) : null;
      if (id && !existing) throw new Error("Lista de compras não encontrada.");
      const name = String(data.name || "").trim();
      if (!name) throw new Error("Informe o nome da lista.");
      const budget = round2(data.budget);
      if (budget < 0) throw new Error("O orçamento não pode ser negativo.");
      if (existing) {
        Object.assign(existing, { name, budget, favorite: data.favorite === true, updatedAt: new Date().toISOString() });
        store.addAudit("Lista de compras editada", "Compra", existing.id, name);
        return store.save();
      }
      const list = {
        id: store.nextId(store.state.shoppingLists, "CMP", 3), name, budget,
        favorite: data.favorite === true, status: "active", items: [], generatedTxIds: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      store.state.shoppingLists.unshift(list);
      store.addAudit("Lista de compras criada", "Compra", list.id, name);
      return store.save();
    },

    toggleShoppingListFavorite(id) {
      const list = store.state.shoppingLists.find((item) => item.id === id);
      if (!list) throw new Error("Lista de compras não encontrada.");
      list.favorite = !list.favorite;
      list.updatedAt = new Date().toISOString();
      store.addAudit(list.favorite ? "Lista marcada como favorita" : "Lista removida dos favoritos", "Compra", list.id, list.name);
      return store.save();
    },

    duplicateShoppingList(id) {
      const list = store.state.shoppingLists.find((item) => item.id === id);
      if (!list) throw new Error("Lista de compras não encontrada.");
      const itemIds = [];
      const copy = {
        ...JSON.parse(JSON.stringify(list)),
        id: store.nextId(store.state.shoppingLists, "CMP", 3),
        name: `${list.name} (cópia)`.slice(0, 80), status: "active", favorite: list.favorite,
        generatedTxIds: [], completedAt: null,
        items: list.items.map((item) => {
          const id = store.nextId([...store.state.shoppingLists.flatMap((entry) => entry.items || []), ...itemIds], "ITEM", 4);
          itemIds.push({ id });
          return { ...item, id, purchased: false, effectivePrice: 0 };
        }),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      store.state.shoppingLists.unshift(copy);
      store.addAudit("Lista de compras duplicada", "Compra", copy.id, copy.name);
      return store.save();
    },

    archiveShoppingList(id) {
      const list = store.state.shoppingLists.find((item) => item.id === id);
      if (!list) throw new Error("Lista de compras não encontrada.");
      list.status = "archived";
      list.updatedAt = new Date().toISOString();
      store.addAudit("Lista de compras arquivada", "Compra", list.id, list.name);
      return store.save();
    },

    saveShoppingItem(listId, data, itemId) {
      const list = store.state.shoppingLists.find((item) => item.id === listId);
      if (!list) throw new Error("Lista de compras não encontrada.");
      assertShoppingEditable(list);
      const existing = itemId ? list.items.find((item) => item.id === itemId) : null;
      if (itemId && !existing) throw new Error("Item não encontrado nesta lista.");
      const name = String(data.name || "").trim();
      if (!name) throw new Error("Informe o nome do item.");
      const quantity = num(data.quantity);
      if (!(quantity > 0)) throw new Error("A quantidade deve ser maior que zero.");
      const unit = String(data.unit || "un").trim();
      if (!unit) throw new Error("Informe a unidade.");
      requireExpenseCategory(data.category);
      const estimatedPrice = round2(data.estimatedPrice);
      const effectivePrice = round2(data.effectivePrice);
      if (estimatedPrice < 0 || effectivePrice < 0) throw new Error("Os preços não podem ser negativos.");
      const values = {
        name, quantity, unit, category: data.category, estimatedPrice, effectivePrice,
        purchased: data.purchased === true, note: String(data.note || "").trim(), updatedAt: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, values);
      else list.items.push({ id: store.nextId(store.state.shoppingLists.flatMap((entry) => entry.items || []), "ITEM", 4), ...values, createdAt: new Date().toISOString() });
      list.updatedAt = new Date().toISOString();
      store.addAudit(existing ? "Item de compra editado" : "Item de compra criado", "Compra", list.id, name);
      return store.save();
    },

    toggleShoppingItem(listId, itemId) {
      const list = store.state.shoppingLists.find((item) => item.id === listId);
      const item = list?.items?.find((entry) => entry.id === itemId);
      if (!list || !item) throw new Error("Item não encontrado.");
      assertShoppingEditable(list);
      item.purchased = !item.purchased;
      if (item.purchased && !(num(item.effectivePrice) > 0) && num(item.estimatedPrice) > 0) item.effectivePrice = item.estimatedPrice;
      item.updatedAt = new Date().toISOString();
      list.updatedAt = new Date().toISOString();
      store.addAudit(item.purchased ? "Item marcado como comprado" : "Item reaberto", "Compra", list.id, item.name);
      return store.save();
    },

    deleteShoppingItem(listId, itemId) {
      const list = store.state.shoppingLists.find((item) => item.id === listId);
      const item = list?.items?.find((entry) => entry.id === itemId);
      if (!list || !item) throw new Error("Item não encontrado.");
      assertShoppingEditable(list);
      list.items = list.items.filter((entry) => entry.id !== itemId);
      list.updatedAt = new Date().toISOString();
      store.addAudit("Item de compra excluído", "Compra", list.id, item.name);
      return store.save();
    },

    generateShoppingExpense(listId, data) {
      const list = store.state.shoppingLists.find((item) => item.id === listId);
      if (!list) throw new Error("Lista de compras não encontrada.");
      if (list.generatedTxIds?.length) throw new Error("Esta lista já gerou despesa. Não é possível duplicar a cobrança.");
      if (list.status !== "active") throw new Error("Somente listas ativas podem gerar despesa.");
      const incomplete = list.items.filter((item) => item.purchased && num(item.estimatedPrice) > 0 && !(num(item.effectivePrice) > 0));
      if (incomplete.length) throw new Error(`Informe o preço efetivo de ${incomplete[0].name}.`);
      const purchased = list.items.filter((item) => item.purchased && round2(num(item.quantity) * num(item.effectivePrice)) > 0);
      if (!purchased.length) throw new Error("Marque ao menos um item comprado com valor para gerar a despesa.");
      const account = requireCashAccount(data.account, "conta de pagamento");
      const category = requireExpenseCategory(data.category);
      const mode = data.mode === "per-item" ? "per-item" : "consolidated";
      const date = data.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Informe a data da compra.");
      const method = store.state.settings.methods.includes(data.method) ? data.method : "PIX";
      const created = [];
      const makeTransaction = (description, amount, categoryName, itemIds) => {
        const txCategory = expenseCategory(categoryName) || category;
        const id = store.nextId([...store.state.transactions, ...created], "LAN", 4);
        const tx = {
          id, type: "despesa", description, amount: round2(amount),
          category: txCategory.name, subcategory: txCategory.subcategory, section: "Gastos do mês",
          account: account.id, costCenter: "Casa", date, dueDate: date, paidDate: date, status: "Pago", method,
          note: String(data.note || "").trim(), document: "", payments: [{ id: `PG-${id}-1`, date, amount: round2(amount), account: account.id, note: "" }],
          groupId: `SHOP:${list.id}`, sourceRef: `Lista ${list.id} · ${list.name}`, shoppingListId: list.id,
          shoppingItemIds: itemIds, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cancelled: false,
        };
        created.push(tx);
        return tx;
      };
      if (mode === "consolidated") {
        makeTransaction(`Compra — ${list.name}`, purchased.reduce((total, item) => total + num(item.quantity) * num(item.effectivePrice), 0), category.name, purchased.map((item) => item.id));
      } else {
        purchased.forEach((item) => makeTransaction(item.name, num(item.quantity) * num(item.effectivePrice), item.category, [item.id]));
      }
      store.state.transactions.unshift(...created);
      list.generatedTxIds = created.map((tx) => tx.id);
      list.status = "completed";
      list.completedAt = new Date().toISOString();
      list.updatedAt = list.completedAt;
      store.addAudit("Despesa gerada de lista de compras", "Compra", list.id, `${created.length} lançamento(s) — ${money(created.reduce((total, tx) => total + tx.amount, 0))}`);
      return store.save();
    },

    async saveRecurring(data, id) {
      const existing = id ? store.state.recurring.find((rule) => rule.id === id) : null;
      if (id && !existing) throw new Error("Recorrência não encontrada.");
      const description = String(data.description || "").trim();
      if (!description) throw new Error("Informe a descrição da recorrência.");
      const type = data.type === "receita" ? "receita" : "despesa";
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      const category = findCategory(data.category, data.subcategory);
      if (!category || category.type !== (type === "receita" ? "Receita" : "Despesa")) throw new Error("Selecione uma categoria compatível com o tipo.");
      const account = calc.accountById(data.account);
      if (!account || !account.active) throw new Error("Selecione uma conta ativa.");
      if (account.type === "Cartão de crédito" && type !== "despesa") throw new Error("Receitas não podem ser registradas em cartões de crédito.");
      const frequency = ["weekly", "biweekly", "monthly", "annual", "custom"].includes(data.frequency) ? data.frequency : "monthly";
      const intervalDays = frequency === "custom" ? Math.floor(num(data.intervalDays)) : null;
      if (frequency === "custom" && !(intervalDays > 0)) throw new Error("Informe o intervalo personalizado em dias.");
      const startDate = data.startDate || existing?.startDate;
      if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Informe a data inicial.");
      const endDate = data.endDate || null;
      if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)) throw new Error("A data final deve ser válida e posterior ao início.");
      const status = ["active", "paused", "ended"].includes(data.status) ? data.status : existing?.status || "active";
      if (existing?.status === "ended" && status !== "ended") throw new Error("Uma recorrência encerrada não pode ser reativada. Crie uma nova regra.");
      const method = store.state.settings.methods.includes(data.method) ? data.method : "PIX";
      const section = account.type === "Cartão de crédito" && type === "despesa" ? "Cartão de crédito" : DEFAULT_LISTS.sections.includes(data.section) ? data.section : type === "receita" ? "Entradas" : "Contas fixas";
      const values = {
        description, type, amount, category: category.name, subcategory: category.subcategory,
        account: account.id, frequency, intervalDays, startDate, endDate, status,
        active: status === "active", method, section, costCenter: String(data.costCenter || "").trim(),
        reviewBeforeGenerate: data.reviewBeforeGenerate === true, note: String(data.note || "").trim(),
        donorId: type === "receita" ? String(data.donorId || "") : "", updatedAt: new Date().toISOString(),
      };
      return commitValidated((candidate) => {
        const rule = existing ? candidate.recurring.find((item) => item.id === existing.id) : null;
        if (rule) Object.assign(rule, values);
        else candidate.recurring.unshift({
          id: store.nextId(candidate.recurring, "REC", 3), ...values,
          occurrenceKeys: [], createdAt: new Date().toISOString(),
        });
      }, { action: existing ? "Recorrência editada" : "Recorrência criada", entity: "Recorrência", ref: id || description, detail: `${description} — ${money(amount)}` });
    },

    async previewRecurring(id, through) {
      const rule = store.state.recurring.find((item) => item.id === id);
      if (!rule) throw new Error("Recorrência não encontrada.");
      const model = await import("../../backend/src/services/finance.js");
      return model.missingOccurrences(rule, through || todayISO());
    },

    async generateRecurring(id, through, selectedKeys) {
      const model = await import("../../backend/src/services/finance.js");
      const result = model.generateRecurringOccurrences(store.state, id, through || todayISO(), selectedKeys);
      if (!result.created.length) throw new Error("Nenhuma ocorrência pendente neste período.");
      store.state = result.state;
      await store.save();
      return result.created;
    },

    async setRecurringStatus(id, status) {
      const rule = store.state.recurring.find((item) => item.id === id);
      if (!rule) throw new Error("Recorrência não encontrada.");
      if (!["active", "paused", "ended"].includes(status)) throw new Error("Status inválido.");
      if (rule.status === "ended" && status !== "ended") throw new Error("Uma recorrência encerrada não pode ser reativada.");
      return commitValidated((candidate) => {
        const item = candidate.recurring.find((entry) => entry.id === id);
        item.status = status;
        item.active = status === "active";
        item.updatedAt = new Date().toISOString();
      }, { action: status === "active" ? "Recorrência retomada" : status === "paused" ? "Recorrência pausada" : "Recorrência encerrada", entity: "Recorrência", ref: id, detail: rule.description });
    },

    async saveReminder(data, id) {
      const existing = id ? store.state.reminders.find((reminder) => reminder.id === id) : null;
      if (id && !existing) throw new Error("Lembrete não encontrado.");
      const title = String(data.title || "").trim();
      if (!title) throw new Error("Informe o título do lembrete.");
      const type = data.type === "financial" ? "financial" : "note";
      const priority = ["low", "normal", "high"].includes(data.priority) ? data.priority : "normal";
      let remindAt = null;
      if (data.remindAt) {
        const date = new Date(data.remindAt);
        if (Number.isNaN(date.getTime())) throw new Error("Informe uma data e hora válidas.");
        remindAt = date.toISOString();
      }
      const linkType = ["", "account", "goal", "transaction"].includes(data.linkType) ? data.linkType : "";
      const linkId = linkType ? String(data.linkId || "") : "";
      if (linkType === "account" && !calc.accountById(linkId)) throw new Error("Conta vinculada não encontrada.");
      if (linkType === "goal" && !store.state.goals.some((goal) => goal.id === linkId)) throw new Error("Meta vinculada não encontrada.");
      if (linkType === "transaction" && !calc.txById(linkId)) throw new Error("Movimentação vinculada não encontrada.");
      const completed = data.completed === true;
      const now = new Date().toISOString();
      const values = {
        title, type, priority, remindAt, linkType, linkId, note: String(data.note || "").trim(), completed,
        completedAt: completed ? existing?.completedAt || now : null, updatedAt: now,
      };
      return commitValidated((candidate) => {
        const reminder = existing ? candidate.reminders.find((item) => item.id === existing.id) : null;
        if (reminder) Object.assign(reminder, values);
        else candidate.reminders.unshift({ id: store.nextId(candidate.reminders, "LEM", 3), ...values, createdAt: now });
      }, { action: existing ? "Lembrete editado" : "Lembrete criado", entity: "Lembrete", ref: id || title, detail: title });
    },

    async toggleReminder(id) {
      const reminder = store.state.reminders.find((item) => item.id === id);
      if (!reminder) throw new Error("Lembrete não encontrado.");
      const completed = !reminder.completed;
      return commitValidated((candidate) => {
        const item = candidate.reminders.find((entry) => entry.id === id);
        item.completed = completed;
        item.completedAt = completed ? new Date().toISOString() : null;
        item.updatedAt = new Date().toISOString();
      }, { action: completed ? "Lembrete concluído" : "Lembrete reaberto", entity: "Lembrete", ref: id, detail: reminder.title });
    },

    async deleteReminder(id) {
      const reminder = store.state.reminders.find((item) => item.id === id);
      if (!reminder) throw new Error("Lembrete não encontrado.");
      return commitValidated((candidate) => {
        candidate.reminders = candidate.reminders.filter((item) => item.id !== id);
      }, { action: "Lembrete excluído", entity: "Lembrete", ref: id, detail: reminder.title });
    },

    async saveCardPurchase(data, purchaseId) {
      const model = await import("../../backend/src/services/finance.js");
      const result = model.saveCardPurchase(store.state, data, purchaseId || null);
      store.state = result.state;
      store.addAudit(purchaseId ? "Compra de cartão editada" : "Compra de cartão criada", "Compra", result.purchaseId, `${data.description} — ${money(data.total ?? data.amount)}`);
      await store.save();
      return result;
    },

    async cancelCardPurchase(purchaseId, reason) {
      const model = await import("../../backend/src/services/finance.js");
      const result = model.cancelCardPurchase(store.state, purchaseId, reason);
      store.state = result.state;
      store.addAudit("Compra de cartão cancelada", "Compra", purchaseId, reason);
      await store.save();
      return result;
    },

    async listInvoices(cardId) {
      const model = await import("../../backend/src/services/finance.js");
      return calc.cardMonths(cardId).map((key) => {
        const invoice = model.cardInvoice(store.state, cardId, key);
        return {
          ...invoice,
          purchases: store.state.transactions.filter((tx) => !calc.isCancelled(tx) && tx.account === cardId && tx.invoiceMonth === key),
          payments: store.state.transfers.filter((transfer) => transfer.toAccount === cardId && transfer.invoiceMonth === key),
        };
      });
    },

    async payInvoice(cardId, invoiceMonth, data) {
      const model = await import("../../backend/src/services/finance.js");
      const result = model.payCardInvoice(store.state, cardId, invoiceMonth, data);
      store.state = result.state;
      store.addAudit("Fatura paga", "Fatura", `${cardId}-${invoiceMonth}`, `${money(result.transfer.amount)} — ${calc.accountName(result.transfer.fromAccount)}`);
      await store.save();
      return result.transfer;
    },

    async reverseInvoicePayment(transferId) {
      const model = await import("../../backend/src/services/finance.js");
      const result = model.reverseInvoicePayment(store.state, transferId);
      store.state = result.state;
      store.addAudit("Pagamento de fatura estornado", "Fatura", transferId, money(result.transfer.amount));
      await store.save();
      return result.transfer;
    },

    async getAnnualSummary(year) {
      const model = await import("../../backend/src/services/finance.js");
      return model.annualSummary(store.state, year);
    },

    async saveDonor(data, id) {
      const existing = id ? store.state.donors.find((donor) => donor.id === id) : null;
      if (id && !existing) throw new Error("Ofertante não encontrado.");
      const name = String(data.name || "").trim();
      if (!name) throw new Error("Informe o nome do ofertante.");
      if (store.state.donors.some((donor) => donor.id !== id && donor.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
        throw new Error("Já existe um ofertante com este nome.");
      }
      const values = { name, contact: String(data.contact || "").trim(), note: String(data.note || "").trim(), active: data.active !== false, updatedAt: new Date().toISOString() };
      return commitValidated((candidate) => {
        const donor = existing ? candidate.donors.find((item) => item.id === existing.id) : null;
        if (donor) Object.assign(donor, values);
        else candidate.donors.unshift({ id: store.nextId(candidate.donors, "DOA", 3), ...values, createdAt: new Date().toISOString() });
      }, { action: existing ? "Ofertante editado" : "Ofertante criado", entity: "Ofertante", ref: id || name, detail: name });
    },

    async toggleDonor(id) {
      const donor = store.state.donors.find((item) => item.id === id);
      if (!donor) throw new Error("Ofertante não encontrado.");
      return commitValidated((candidate) => {
        const item = candidate.donors.find((entry) => entry.id === id);
        item.active = !item.active;
        item.updatedAt = new Date().toISOString();
      }, { action: donor.active ? "Ofertante desativado" : "Ofertante reativado", entity: "Ofertante", ref: id, detail: donor.name });
    },

    async deleteDonor(id) {
      const donor = store.state.donors.find((item) => item.id === id);
      if (!donor) throw new Error("Ofertante não encontrado.");
      if (store.state.transactions.some((tx) => tx.donorId === id) || store.state.recurring.some((rule) => rule.donorId === id)) {
        throw new Error("Este ofertante possui receitas vinculadas. Desative o cadastro para preservar o histórico.");
      }
      return commitValidated((candidate) => {
        candidate.donors = candidate.donors.filter((item) => item.id !== id);
      }, { action: "Ofertante excluído", entity: "Ofertante", ref: id, detail: donor.name });
    },

    async saveTransaction(data, id) {
      const type = data.type === "receita" ? "receita" : "despesa";
      const section = DEFAULT_LISTS.sections.includes(data.section) ? data.section : type === "receita" ? "Entradas" : "Gastos do mês";
      if (!data.description || !String(data.description).trim()) throw new Error("Informe uma descrição.");
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error("O valor deve ser maior que zero.");
      if (!data.date) throw new Error("Informe a data do lançamento.");
      if (!data.account || !calc.accountById(data.account)) throw new Error("Selecione uma conta válida.");
      requireCategory(data.category, data.subcategory, type);
      const existing = id ? calc.txById(id) : null;
      if (calc.accountById(data.account)?.type === "Cartão de crédito" || existing?.account && calc.accountById(existing.account)?.type === "Cartão de crédito") {
        throw new Error("Use a tela Cartões e faturas para registrar ou editar compras no cartão.");
      }

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
          section,
          account: data.account,
          costCenter: data.costCenter || "",
          amount,
          date: data.date,
          dueDate: data.dueDate || data.date,
          method: data.method || "PIX",
          note: data.note || "",
          document: data.document || "",
          donorId: type === "receita" ? String(data.donorId || "") : "",
          updatedAt: new Date().toISOString(),
        });
        if (existing.groupId) {
          const g = store.state.installmentGroups.find((x) => x.id === existing.groupId);
          if (g) { g.category = data.category; g.subcategory = data.subcategory; g.section = section; g.account = data.account; g.costCenter = data.costCenter || ""; }
        }
        store.addAudit("Lançamento editado", "Lançamento", existing.id, `${existing.description} — ${money(existing.amount)}`);
        await store.save();
        return existing;
      }

      const tx = {
        id: store.nextId(store.state.transactions, "LAN", 4),
        type,
        description: String(data.description).trim(),
        category: data.category,
        subcategory: data.subcategory,
        section,
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
        donorId: type === "receita" ? String(data.donorId || "") : "",
      };
      if (data.settleNow) {
        const pdate = data.settleDate || data.dueDate || data.date;
        tx.payments.push({ id: `PG-${tx.id}-1`, date: pdate, amount, account: data.account, note: "Baixa na criação" });
        tx.paidDate = pdate;
        tx.status = type === "receita" ? "Recebido" : "Pago";
      }
      store.state.transactions.unshift(tx);
      store.addAudit("Lançamento criado", "Lançamento", tx.id, `${tx.description} — ${money(tx.amount)}`);
      await store.save();
      return tx;
    },

    registerPayment(id, data) {
      const tx = calc.txById(id);
      if (!tx) throw new Error("Lançamento não encontrado.");
      if (calc.accountById(tx.account)?.type === "Cartão de crédito") throw new Error("Liquide compras de cartão pelo pagamento da fatura, não por baixa direta.");
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
      if (calc.accountById(tx.account)?.type === "Cartão de crédito") throw new Error("Pagamentos de cartão são estornados na tela de faturas.");
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
      if (calc.accountById(tx.account)?.type === "Cartão de crédito") throw new Error("Use a tela Cartões e faturas para cancelar a compra completa.");
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
      if (calc.accountById(data.fromAccount)?.type === "Cartão de crédito" || calc.accountById(data.toAccount)?.type === "Cartão de crédito") {
        throw new Error("Para liquidar uma fatura, use o pagamento por mês na tela Cartões e faturas.");
      }
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
        const finCat = store.state.categories.find((c) => c.name === "Contas" && c.type === "Despesa")
          || store.state.categories.find((c) => c.type === "Despesa");
        const feeTx = {
          id: store.nextId(store.state.transactions, "LAN", 4),
          type: "despesa",
          description: `Taxa de transferência ${tr.id}`,
          category: finCat ? finCat.name : "Não classificado",
          subcategory: finCat ? finCat.subcategory : "Revisar",
          section: "Gastos do mês",
          account: tr.fromAccount,
          costCenter: "Casa",
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
      if (tr.invoiceMonth) {
        throw new Error("Pagamentos de fatura devem ser estornados na tela Cartões e faturas para preservar o vínculo com a fatura.");
      }
      if (store.state.goals.some((goal) => goal.initialTransferId === id || goal.movements?.some((movement) => movement.transferId === id))) {
        throw new Error("Esta transferência está vinculada a uma meta. Estorne o movimento da meta para preservar o histórico.");
      }
      store.state.transfers.splice(idx, 1);
      store.state.transactions = store.state.transactions.filter((t) => t.groupId !== `TRF:${tr.id}`);
      store.addAudit("Transferência excluída", "Transferência", id, `${money(tr.amount)} — registro removido`);
      store.save();
    },

    async saveAccount(data, id) {
      if (!data.name || !String(data.name).trim()) throw new Error("Informe o nome da conta.");
      const values = {
        name: String(data.name).trim(), institution: String(data.institution || "").trim(),
        type: data.type || "Conta corrente", openingBalance: round2(data.openingBalance), active: data.active !== false,
      };
      if (values.type === "Cartão de crédito") Object.assign(values, {
        closingDay: Math.floor(num(data.closingDay) || 31), dueDay: Math.floor(num(data.dueDay) || 31),
        limit: round2(data.limit), brand: String(data.brand || "").trim(),
        color: /^#[0-9a-f]{6}$/i.test(data.color || "") ? data.color : "#7c6a9c",
      });
      return commitValidated((candidate) => {
        const account = id ? candidate.accounts.find((item) => item.id === id) : null;
        if (id && !account) throw new Error("Conta não encontrada.");
        if (account) {
          Object.assign(account, values);
          return account;
        }
        const created = { id: store.nextId(candidate.accounts, "ACC", 3), ...values };
        candidate.accounts.push(created);
        return created;
      }, { action: id ? "Conta editada" : "Conta criada", entity: "Conta", ref: id || values.name, detail: values.name });
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
      const section = DEFAULT_LISTS.sections.includes(data.section) ? data.section : type === "receita" ? "Entradas" : "Gastos do mês";
      requireCategory(data.category, data.subcategory, type);
      if (!data.account || !calc.accountById(data.account)) throw new Error("Selecione a conta.");
      if (calc.accountById(data.account).type === "Cartão de crédito") throw new Error("Parcelamentos no cartão são registrados como compras na tela Cartões e faturas.");
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
          category: data.category, subcategory: data.subcategory, section,
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
        totalAmount: total, count, recordedCount: count, category: data.category, subcategory: data.subcategory, section,
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

    async updateProfile(name) {
      const profileName = String(name || "").trim().slice(0, 60);
      if (!profileName) throw new Error("Informe o nome do perfil.");
      if (store.remote) {
        const result = await FM.api.updateProfile(profileName);
        FM.api.user = result.user;
      }
      store.state.meta.name = profileName;
      store.state.meta.email = FM.api.user?.email || store.state.meta.email || "";
      store.addAudit("Perfil atualizado", "Sistema", "—", profileName);
      return store.save();
    },
    setTheme(theme) {
      if (!["light", "dark"].includes(theme)) throw new Error("Tema inválido.");
      store.state.settings.theme = theme;
      if (FM.theme) FM.theme.apply(theme);
      store.addAudit("Tema atualizado", "Sistema", "—", theme === "dark" ? "Escuro" : "Claro");
      return store.save();
    },
    updateNotifications(input) {
      const current = calc.notificationSettings();
      const value = { ...current, ...(input || {}) };
      const dueDays = Number(value.dueDays);
      const budgetWarning = Number(value.budgetWarning);
      const budgetCritical = Number(value.budgetCritical);
      const goalInactivityDays = Number(value.goalInactivityDays);
      if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 60) throw new Error("O aviso de vencimento deve ser de 1 a 60 dias.");
      if (!Number.isInteger(budgetWarning) || budgetWarning < 50 || budgetWarning > 99) throw new Error("O aviso de orçamento deve ser de 50% a 99%.");
      if (!Number.isInteger(budgetCritical) || budgetCritical < 100 || budgetCritical > 200 || budgetCritical <= budgetWarning) throw new Error("O limite crítico deve ser de 100% a 200% e maior que o aviso.");
      if (!Number.isInteger(goalInactivityDays) || goalInactivityDays < 1 || goalInactivityDays > 365) throw new Error("A inatividade de metas deve ser de 1 a 365 dias.");
      store.state.settings.notifications = { dueDays, budgetWarning, budgetCritical, goalInactivityDays };
      store.addAudit("Notificações atualizadas", "Sistema", "—", `${dueDays} dias · orçamento ${budgetWarning}%/${budgetCritical}% · metas ${goalInactivityDays} dias`);
      return store.save();
    },
    async changePassword(currentPassword, newPassword) {
      if (!store.remote) throw new Error("A troca de senha está disponível somente para contas cadastradas.");
      await FM.api.changePassword(currentPassword, newPassword);
    },
    async deleteAccount() {
      if (!store.remote) throw new Error("A exclusão de conta está disponível somente para contas cadastradas.");
      await FM.api.deleteAccount();
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

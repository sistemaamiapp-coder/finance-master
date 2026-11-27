/* =========================================================
   LIVIS FINANCE — store, cálculos e regras de negócio
   ========================================================= */
(function () {
  "use strict";
  const FM = (window.FM = window.FM || {});
  const KEY = "livis_finance.v2";
  const UI_KEY = "livis_finance.ui.v2";
  const VERSION = 2;

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
    methods: ["Débito", "Crédito 1", "Crédito 2", "Crédito 3", "Crédito 4", "PIX", "Dinheiro", "Boleto", "Transferência"],
    periodicities: ["Única", "Semanal", "Mensal", "Anual"],
    types: ["Receita", "Despesa"],
    statuses: ["Previsto", "Pago", "Recebido", "Parcial", "Atrasado", "Cancelado"],
    sections: ["Contas fixas", "Gastos do mês", "Cartão de crédito", "Entradas", "Investimento"],
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
        const notes = [
          detail,
          cat.inferred ? "Categoria sugerida pelo sistema; não informada na planilha." : "",
          "Data de referência: primeiro dia do mês; o dia não foi informado.",
        ];
        addTx({
          date: refDate, dueDate: refDate, type: "despesa", section: "Cartão de crédito", description,
          category: cat.name, subcategory: cat.name === "Não classificado" ? "Revisar" : "Geral",
          account: accountFor(method), costCenter: "Cartões", amount, method, settle: refDate,
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
      meta: { org: "Livis Finance", source: "Contas 2026 Envios Extra.xlsx", defaultMonth: "2026-11", createdAt: now, updatedAt: now },
      accounts, categories, costCenters, transactions, transfers: [],
      budgets: [], reconciliations: [], installmentGroups,
      settings: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
      audit: [{ id: uid("AUD"), ts: now, action: "Planilha importada", entity: "Contas 2026", ref: "Outubro a dezembro", detail: "Valores válidos importados; categorias ausentes receberam sugestões e datas não informadas usaram referência mensal." }],
    };
  }

  function emptyState() {
    return {
      version: VERSION,
      meta: { org: "Livis Finance", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
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
      loaded.settings = Object.assign({}, DEFAULT_LISTS, loaded.settings || {});
      loaded.meta = Object.assign({ org: "Livis Finance" }, loaded.meta || {});
      delete loaded.meta.theme;
      const legacyOrg = ["Luvis Finance", "Ministério AMI", "Minha organização"];
      if (!loaded.meta.org || legacyOrg.includes(loaded.meta.org)) loaded.meta.org = "Livis Finance";
      loaded.audit = loaded.audit || [];
      loaded.installmentGroups = loaded.installmentGroups || [];
      loaded.transactions.forEach((t) => {
        if (!t.section) t.section = t.type === "receita" ? "Entradas" : t.groupId ? "Gastos do mês" : "Contas fixas";
      });
      loaded.installmentGroups.forEach((g) => {
        if (!g.recordedCount) g.recordedCount = loaded.transactions.filter((t) => t.groupId === g.id).length;
      });
      this.state = loaded;
      try {
        const ui = JSON.parse(localStorage.getItem(UI_KEY) || "null");
        if (ui && /^\d{4}-\d{2}$/.test(ui.month || "")) this.ui.month = ui.month;
        else if (/^\d{4}-\d{2}$/.test(loaded.meta.defaultMonth || "")) this.ui.month = loaded.meta.defaultMonth;
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
      const name = `livis-finance-backup-${todayISO()}.json`;
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
      data.meta = Object.assign({ org: "Livis Finance" }, data.meta || {});
      delete data.meta.theme;
      const legacyOrg = ["Luvis Finance", "Ministério AMI", "Minha organização"];
      if (!data.meta.org || legacyOrg.includes(data.meta.org)) data.meta.org = "Livis Finance";
      data.audit = data.audit || [];
      data.installmentGroups = data.installmentGroups || [];
      data.transactions.forEach((t) => {
        if (!t.section) t.section = t.type === "receita" ? "Entradas" : t.groupId ? "Gastos do mês" : "Contas fixas";
      });
      data.installmentGroups.forEach((g) => {
        if (!g.recordedCount) g.recordedCount = data.transactions.filter((t) => t.groupId === g.id).length;
      });
      this.state = data;
      this.addAudit("Backup restaurado", "Sistema", "—", "Dados importados de arquivo JSON.");
      this.save();
    },
    restoreSheet() {
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

    isCashAccount(acc) {
      return !!acc && !["Cartão de crédito", "Cartão", "Investimento"].includes(acc.type);
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
      const section = DEFAULT_LISTS.sections.includes(data.section) ? data.section : type === "receita" ? "Entradas" : "Gastos do mês";
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
          section,
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
          if (g) { g.category = data.category; g.subcategory = data.subcategory; g.section = section; g.account = data.account; g.costCenter = data.costCenter || ""; }
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
      const section = DEFAULT_LISTS.sections.includes(data.section) ? data.section : type === "receita" ? "Entradas" : "Gastos do mês";
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

    updateOrg(name) {
      store.state.meta.org = String(name || "").trim() || "Livis Finance";
      store.addAudit("Perfil atualizado", "Sistema", "—", store.state.meta.org);
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

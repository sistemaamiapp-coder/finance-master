/* =========================================================
   LIVIS FINANCE — roteador e inicialização
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const { esc, money, fmtDate, addMonthsKey, monthLabel, todayISO } = U;
  const icon = FM.ui.icon;

  const ROUTES = {
    dashboard: { title: "Dashboard", sub: "Visão geral financeira", period: true },
    lancamentos: { title: "Lançamentos", sub: "Base central de receitas e despesas", period: true },
    "a-pagar": { title: "Contas a pagar", sub: "Compromissos e vencimentos", period: false },
    "a-receber": { title: "Contas a receber", sub: "Cobranças e recebíveis", period: false },
    transferencias: { title: "Transferências", sub: "Movimentação entre contas", period: false },
    parcelamentos: { title: "Parcelamentos", sub: "Compras e compromissos parcelados", period: false },
    "fluxo-caixa": { title: "Fluxo de caixa", sub: "Realizado e projeção de caixa", period: true },
    contas: { title: "Contas e investimentos", sub: "Saldos, cartões e aplicações", period: true },
    conciliacao: { title: "Conciliação", sub: "Extrato bancário x sistema", period: false },
    orcamento: { title: "Orçamento", sub: "Planejado x realizado", period: true },
    categorias: { title: "Categorias", sub: "Classificação financeira", period: true },
    centros: { title: "Centros de custo", sub: "Áreas, projetos e responsáveis", period: true },
    dre: { title: "DRE gerencial", sub: "Resultado do período", period: true },
    relatorios: { title: "Relatórios", sub: "Exportações e relatório impresso", period: true },
    guia: { title: "Guia & dicas", sub: "Regras, rotinas e evolução", period: false },
    configuracoes: { title: "Configurações", sub: "Preferências, listas e backup", period: false },
  };

  let lastRoute = null;

  const $ = (sel) => document.querySelector(sel);

  function currentRoute() {
    const raw = (location.hash || "").replace(/^#\/?/, "").split("?")[0].trim();
    return ROUTES[raw] ? raw : "dashboard";
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "auto" });
    const main = $(".main");
    if (main) main.scrollTop = 0;
  }

  function updateChrome() {
    const state = FM.store.state;
    const meta = state.meta || {};
    const org = meta.org || "Livis Finance";

    const orgName = $("#org-name");
    if (orgName) orgName.textContent = org;
    const avatar = $("#org-avatar");
    if (avatar) {
      const initials = org.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      avatar.textContent = initials || "LF";
    }

    const calc = FM.calc;
    const pay = calc.openTotals("despesa");
    const rec = calc.openTotals("receita");
    const payEl = document.querySelector('[data-count="payables"]');
    const recEl = document.querySelector('[data-count="receivables"]');
    if (payEl) {
      payEl.hidden = pay.count === 0;
      payEl.textContent = pay.count;
      payEl.classList.toggle("danger", pay.overdue.count > 0);
      payEl.title = `${pay.count} em aberto · ${money(pay.total)}`;
    }
    if (recEl) {
      recEl.hidden = rec.count === 0;
      recEl.textContent = rec.count;
      recEl.title = `${rec.count} em aberto · ${money(rec.total)}`;
    }

    const footer = $("#footer-date");
    if (footer) {
      const text = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      footer.textContent = text.charAt(0).toUpperCase() + text.slice(1);
    }

    const periodInput = $("#period-input");
    if (periodInput && periodInput.value !== FM.store.ui.month) periodInput.value = FM.store.ui.month;
    const periodText = $("#period-text");
    if (periodText) periodText.textContent = monthLabel(FM.store.ui.month, "long");
  }

  function render() {
    const route = currentRoute();
    const meta = ROUTES[route];
    const mount = $("#view");
    const navItems = document.querySelectorAll("[data-route]");
    navItems.forEach((a) => {
      const on = a.dataset.route === route;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    const titleEl = $("#page-title");
    const subEl = $("#page-sub");
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
    document.title = `${meta.title} — Livis Finance`;

    const period = $("#period-control");
    if (period) period.hidden = !meta.period;
    const periodInput = $("#period-input");
    if (periodInput) periodInput.value = FM.store.ui.month;

    if (!mount) return;
    mount.innerHTML = "";
    try {
      const view = FM.views[route] || FM.views.dashboard;
      view({ month: FM.store.ui.month }, mount);
    } catch (err) {
      console.error("Falha ao renderizar a tela", route, err);
      mount.innerHTML = `<div class="card"><div class="card-body">
        <div class="card-title">${icon("alert")}Não foi possível carregar esta tela</div>
        <p class="small muted mt-8">${esc(err && err.message ? err.message : "Erro inesperado.")}</p>
        <button class="btn sm subtle mt-12" onclick="location.reload()">${icon("refresh")}Recarregar</button>
      </div></div>`;
    }

    updateChrome();
  }

  function onDataChanged() {
    updateChrome();
    render();
  }

  function closeSidebar() {
    const sidebar = $("#sidebar");
    const backdrop = $("#sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }

  function bindSidebar() {
    const menu = $("#menu-btn");
    const sidebar = $("#sidebar");
    const backdrop = $("#sidebar-backdrop");
    if (menu) {
      menu.addEventListener("click", () => {
        if (!sidebar) return;
        const open = sidebar.classList.toggle("open");
        if (backdrop) backdrop.classList.toggle("show", open);
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeSidebar);
    document.querySelectorAll(".nav-item").forEach((a) => a.addEventListener("click", closeSidebar));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSidebar();
    });
  }

  function bindPeriod() {
    const control = $("#period-control");
    if (control) {
      control.querySelectorAll("[data-period]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const delta = Number(btn.dataset.period);
          FM.store.setMonth(addMonthsKey(FM.store.ui.month, delta));
          render();
        });
      });
    }
    const input = $("#period-input");
    if (input) {
      input.addEventListener("change", () => {
        if (/^\d{4}-\d{2}$/.test(input.value)) {
          FM.store.setMonth(input.value);
          render();
        }
      });
      input.addEventListener("click", () => {
        if (typeof input.showPicker === "function") {
          try { input.showPicker(); } catch (e) {}
        }
      });
    }
  }

  function bindSearch() {
    const box = $("#search-box");
    const input = $("#global-search");
    const results = $("#search-results");
    if (!box || !input || !results) return;

    function hide() {
      results.hidden = true;
      results.innerHTML = "";
    }

    function show(query) {
      const q = String(query || "").trim();
      if (q.length < 2) return hide();
      const items = FM.calc.search(q);
      if (!items.length) {
        results.innerHTML = `<div class="sr-empty">Nenhum lançamento encontrado para “${esc(q)}”.</div>`;
      } else {
        results.innerHTML = items.map((t) => `<button type="button" class="sr-item" data-search-tx="${esc(t.id)}">
            ${FM.ui.typeMark(t.type)}
            <span class="sr-main"><strong>${esc(t.description)}</strong><span>${fmtDate(t.date, "short")} · ${esc(t.category)} · ${esc(FM.calc.accountName(t.account))}</span></span>
            <span class="sr-value ${t.type === "receita" ? "text-green" : "text-red"}">${money(t.amount)}</span>
          </button>`).join("") + `<div class="sr-hint">Enter abre o primeiro resultado · Esc fecha</div>`;
      }
      results.hidden = false;
    }

    input.addEventListener("input", () => show(input.value));
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) show(input.value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = results.querySelector("[data-search-tx]");
        if (first) {
          e.preventDefault();
          FM.ui.openTxDetail(first.dataset.searchTx);
          hide();
        }
      }
      if (e.key === "Escape") {
        hide();
        input.blur();
      }
    });
    results.addEventListener("click", (e) => {
      const item = e.target.closest("[data-search-tx]");
      if (!item) return;
      FM.ui.openTxDetail(item.dataset.searchTx);
      hide();
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target)) hide();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || document.querySelector(".modal-overlay")) return;
      e.preventDefault();
      input.focus();
    });
  }

  function bindActions() {
    const newBtn = $("#new-tx-btn");
    if (newBtn) newBtn.addEventListener("click", () => FM.ui.openTxForm(null));

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const pay = target.closest("[data-open-payment]");
      if (pay) {
        e.preventDefault();
        e.stopPropagation();
        FM.ui.openPaymentForm(pay.dataset.openPayment);
        return;
      }
      const edit = target.closest("[data-edit-tx]");
      if (edit) {
        e.preventDefault();
        e.stopPropagation();
        const tx = FM.calc.txById(edit.dataset.editTx);
        if (tx) FM.ui.openTxForm(tx);
        return;
      }
      const newType = target.closest("[data-new-type]");
      if (newType) {
        e.preventDefault();
        e.stopPropagation();
        FM.ui.openTxForm(null, { type: newType.dataset.newType === "receita" ? "receita" : "despesa" });
        return;
      }
      const newTx = target.closest("[data-new-tx]");
      if (newTx) {
        e.preventDefault();
        FM.ui.openTxForm(null);
        return;
      }
      const row = target.closest("[data-open-tx]");
      if (row) {
        FM.ui.openTxDetail(row.dataset.openTx);
      }
    });
  }

  function bindNav() {
    window.addEventListener("hashchange", () => {
      render();
      if (currentRoute() !== lastRoute) scrollTop();
      lastRoute = currentRoute();
      closeSidebar();
    });
  }

  function init() {
    FM.store.init();
    bindSidebar();
    bindPeriod();
    bindSearch();
    bindActions();
    bindNav();

    FM.app = {
      renderCurrent: render,
      onDataChanged,
      go(route) {
        location.hash = "#/" + route;
      },
      routes: ROUTES,
    };

    if (!location.hash) {
      history.replaceState(null, "", "#/dashboard");
    }
    lastRoute = currentRoute();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

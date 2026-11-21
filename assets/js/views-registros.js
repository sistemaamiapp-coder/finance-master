/* =========================================================
   FINANCE MASTER — Lançamentos, contas a pagar/receber, parcelamentos
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const { esc, money, fmtDate, monthLabel, todayISO, dayDiff } = U;
  const icon = FM.ui.icon;

  /* ---------------- shared helpers ---------------- */
  function overdueInfo(t) {
    if (!t.dueDate) return "";
    const d = dayDiff(t.dueDate);
    if (FM.calc.isOpen(t) && d < 0) return `<div class="small text-red">${Math.abs(d)}d em atraso</div>`;
    return "";
  }

  function paymentButtons(t) {
    const C = FM.calc;
    if (C.isCancelled(t)) return "";
    const pay = C.isOpen(t) ? `<button class="icon-btn sm" data-open-payment="${t.id}" title="${t.type === "receita" ? "Registrar recebimento" : "Registrar pagamento"}">${icon("check")}</button>` : "";
    const edit = `<button class="icon-btn sm" data-edit-tx="${t.id}" title="Editar">${icon("edit")}</button>`;
    return pay + edit;
  }

  function txTableRow(t) {
    const C = FM.calc;
    const st = C.effectiveStatus(t);
    const paid = C.paidTotal(t);
    const rem = C.remaining(t);
    return `<tr data-open-tx="${t.id}" class="clickable ${C.isCancelled(t) ? "row-muted" : ""}">
      <td class="mono small muted nowrap">${esc(t.id)}</td>
      <td class="nowrap">${fmtDate(t.date, "short")}</td>
      <td>
        <div class="cell-main">${FM.ui.typeMark(t.type)}
          <div class="cell-text"><div class="cell-title">${esc(t.description)}</div><div class="cell-sub">${esc(t.category)} › ${esc(t.subcategory)}</div></div>
        </div>
      </td>
      <td class="nowrap small">${esc(C.accountName(t.account))}</td>
      <td class="small muted nowrap">${esc(t.costCenter || "—")}</td>
      <td class="nowrap">${fmtDate(t.dueDate, "short")}${overdueInfo(t)}</td>
      <td>${FM.ui.statusBadge(st)}${paid > 0 && rem > 0 ? `<div class="small muted mt-8" style="margin-top:3px">baixado ${money(paid)}</div>` : ""}</td>
      <td class="num"><span class="amount ${t.type === "receita" ? "pos" : "neg"}">${t.type === "receita" ? "+" : "−"} ${money(t.amount)}</span>${rem > 0 && paid > 0 ? `<div class="small muted">aberto ${money(rem)}</div>` : ""}</td>
      <td class="actions">${paymentButtons(t)}</td>
    </tr>`;
  }

  /* =========================================================
     LANÇAMENTOS
     ========================================================= */
  FM.views.lancamentos = function (ctx, mount) {
    const C = FM.calc;
    const st = FM.store.state;
    const F = FM.store.ui.txFilters;
    F.q = F.q || "";
    F.type = F.type || "all";
    F.status = F.status || "all";
    F.account = F.account || "all";
    F.category = F.category || "all";
    F.period = F.period || "month";
    let visible = [];

    const accounts = st.accounts;
    const categories = Array.from(new Set(st.categories.map((c) => c.name))).sort();
    const statuses = ["Previsto", "Pago", "Recebido", "Parcial", "Atrasado", "Cancelado"];

    function filtered() {
      return st.transactions
        .filter((t) => {
          if (F.type !== "all" && t.type !== F.type) return false;
          if (F.account !== "all" && t.account !== F.account) return false;
          if (F.category !== "all" && t.category !== F.category) return false;
          if (F.period === "month" && U.monthKeyOf(t.date) !== ctx.month) return false;
          if (F.status !== "all" && C.effectiveStatus(t) !== F.status) return false;
          if (F.q) {
            const hay = [t.id, t.description, t.category, t.subcategory, t.costCenter, C.accountName(t.account), t.note].join(" ").toLowerCase();
            if (!hay.includes(F.q.toLowerCase())) return false;
          }
          return true;
        })
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    function totals(list) {
      let rec = 0, desp = 0, open = 0;
      list.forEach((t) => {
        if (C.isCancelled(t)) return;
        if (t.type === "receita") rec += U.num(t.amount); else desp += U.num(t.amount);
        open += C.remaining(t);
      });
      return { rec, desp, open };
    }

    const html = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Lançamentos</h2><p>Base central — registre cada operação uma única vez e mantenha o status atualizado.</p></div>
          <div class="content-actions">
            <button class="btn ghost sm" id="tx-export">${icon("download")}Exportar</button>
            <button class="btn primary sm" data-new-tx>${icon("plus")}Novo lançamento</button>
          </div>
        </div>
        <div class="card">
          <div class="summary-row">
            <div class="mini-stat"><span>Receitas no filtro</span><strong class="text-green" id="sum-rec">—</strong></div>
            <div class="mini-stat"><span>Despesas no filtro</span><strong class="text-red" id="sum-desp">—</strong></div>
            <div class="mini-stat"><span>Resultado do filtro</span><strong id="sum-res">—</strong></div>
            <div class="mini-stat"><span>Total em aberto</span><strong id="sum-open">—</strong></div>
            <div class="mini-stat"><span>Registros</span><strong id="sum-count">—</strong></div>
          </div>
          <div class="toolbar">
            <div class="search-inline">${icon("search")}<input class="input" id="flt-q" placeholder="Buscar descrição, ID, categoria..." value="${esc(F.q)}"></div>
            <select class="select" id="flt-type">
              <option value="all" ${F.type === "all" ? "selected" : ""}>Todos os tipos</option>
              <option value="receita" ${F.type === "receita" ? "selected" : ""}>Receitas</option>
              <option value="despesa" ${F.type === "despesa" ? "selected" : ""}>Despesas</option>
            </select>
            <select class="select" id="flt-status">
              <option value="all" ${F.status === "all" ? "selected" : ""}>Todos os status</option>
              ${statuses.map((s) => `<option value="${s}" ${F.status === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <select class="select" id="flt-account">
              <option value="all">Todas as contas</option>
              ${accounts.map((a) => `<option value="${a.id}" ${F.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
            </select>
            <select class="select" id="flt-cat">
              <option value="all">Todas as categorias</option>
              ${categories.map((c) => `<option ${F.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
            <select class="select" id="flt-period">
              <option value="month" ${F.period === "month" ? "selected" : ""}>${esc(monthLabel(ctx.month))}</option>
              <option value="all" ${F.period === "all" ? "selected" : ""}>Todo o período</option>
            </select>
            <div class="toolbar-end"><button class="btn ghost sm" id="flt-clear">${icon("refresh")}Limpar</button></div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr>
                <th>ID</th><th>Data</th><th>Descrição</th><th>Conta</th><th>Centro</th><th>Vencimento</th><th>Status</th><th class="num">Valor</th><th class="actions">Ações</th>
              </tr></thead>
              <tbody id="tx-body"></tbody>
            </table>
          </div>
        </div>
        <p class="small muted mt-12">${icon("info")} Clique em uma linha para abrir o detalhe, registrar baixas parciais, editar ou cancelar mantendo o histórico.</p>
      </div>
    `;
    mount.innerHTML = html;

    const body = mount.querySelector("#tx-body");
    function renderRows() {
      visible = filtered();
      const t = totals(visible);
      mount.querySelector("#sum-rec").textContent = money(t.rec);
      mount.querySelector("#sum-desp").textContent = money(t.desp);
      const resEl = mount.querySelector("#sum-res");
      resEl.textContent = money(t.rec - t.desp);
      resEl.className = t.rec - t.desp >= 0 ? "text-green" : "text-red";
      mount.querySelector("#sum-open").textContent = money(t.open);
      mount.querySelector("#sum-count").textContent = visible.length;
      body.innerHTML = visible.length
        ? visible.map(txTableRow).join("")
        : `<tr><td colspan="9">${FM.ui.emptyState("receipt", "Nenhum lançamento encontrado", "Ajuste os filtros ou registre uma nova operação.", `<button class="btn sm subtle" data-new-tx>${icon("plus")}Novo lançamento</button>`)}</td></tr>`;
    }

    const ids = ["flt-q", "flt-type", "flt-status", "flt-account", "flt-cat", "flt-period"];
    ids.forEach((id) => {
      const el = mount.querySelector("#" + id);
      el.addEventListener(id === "flt-q" ? "input" : "change", () => {
        F.q = mount.querySelector("#flt-q").value;
        F.type = mount.querySelector("#flt-type").value;
        F.status = mount.querySelector("#flt-status").value;
        F.account = mount.querySelector("#flt-account").value;
        F.category = mount.querySelector("#flt-cat").value;
        F.period = mount.querySelector("#flt-period").value;
        renderRows();
      });
    });
    mount.querySelector("#flt-clear").addEventListener("click", () => {
      Object.assign(F, { q: "", type: "all", status: "all", account: "all", category: "all", period: "month" });
      FM.app.renderCurrent();
    });
    mount.querySelector("#tx-export").addEventListener("click", () => {
      const rows = visible.map((t) => [
        t.id, fmtDate(t.date), t.type === "receita" ? "Receita" : "Despesa", t.description,
        `${t.category} › ${t.subcategory}`, FM.calc.accountName(t.account), t.costCenter,
        fmtDate(t.dueDate), fmtDate(t.paidDate), FM.calc.effectiveStatus(t),
        t.method, U.num(t.amount).toFixed(2).replace(".", ","), FM.calc.remaining(t).toFixed(2).replace(".", ","), t.note,
      ]);
      U.downloadCSV(`luvis-finance-lancamentos-${ctx.month}.csv`,
        ["ID", "Data", "Tipo", "Descrição", "Categoria", "Conta", "Centro de custo", "Vencimento", "Baixa", "Status", "Forma", "Valor", "Em aberto", "Observação"],
        rows);
      FM.ui.toast("Lançamentos exportados em CSV.");
    });

    renderRows();
  };

  /* =========================================================
     CONTAS A PAGAR / RECEBER
     ========================================================= */
  function pendingView(type) {
    return function (ctx, mount) {
      const C = FM.calc;
      const st = FM.store.state;
      const isRec = type === "receita";
      const title = isRec ? "Contas a receber" : "Contas a pagar";
      const article = isRec ? "a receber" : "a pagar";
      const verb = isRec ? "Receber" : "Pagar";
      let filter = "open";
      let q = "";
      let visible = [];

      function base() {
        return st.transactions.filter((t) => t.type === type && !C.isCancelled(t));
      }
      function collect() {
        const all = base();
        let list = all.filter((t) => {
          const open = C.isOpen(t);
          if (filter === "open" && !open) return false;
          if (filter === "overdue" && !(open && t.dueDate < todayISO())) return false;
          if (filter === "soon" && !(open && t.dueDate >= todayISO() && dayDiff(t.dueDate) <= 7)) return false;
          if (filter === "settled" && open) return false;
          if (q) {
            const hay = [t.description, t.category, t.subcategory, C.accountName(t.account), t.note, t.id].join(" ").toLowerCase();
            if (!hay.includes(q.toLowerCase())) return false;
          }
          return true;
        });
        list.sort((a, b) => {
          if (filter === "settled") return (b.paidDate || b.dueDate || "").localeCompare(a.paidDate || a.dueDate || "");
          return (a.dueDate || "").localeCompare(b.dueDate || "");
        });
        return list;
      }
      const openAll = C.openTotals(type);
      const monthStats = C.monthStats(ctx.month);
      const settledThisMonth = isRec ? monthStats.receitasRecebidas : monthStats.despesasPagas;

      const html = `
        <div class="page-enter">
          <div class="content-head">
            <div><h2>${title}</h2><p>Visão derivada da base central — evite duplicar registros. ${isRec ? "Acompanhe cobranças e inadimplência." : "Controle compromissos e evite atrasos."}</p></div>
            <div class="content-actions">
              <button class="btn ghost sm" id="pend-export">${icon("download")}Exportar</button>
              <button class="btn primary sm" data-new-type="${type}">${icon("plus")}Nova ${isRec ? "receita" : "despesa"}</button>
            </div>
          </div>
          ${openAll.overdue.count ? `<div class="alert-strip danger">
            <div class="alert-icon">${icon("alert")}</div>
            <div class="alert-text"><strong>${openAll.overdue.count} título(s) vencido(s) — ${money(openAll.overdue.total)}</strong><span>${isRec ? "Faça a cobrança e registre a baixa quando o valor cair na conta." : "Priorize a regularização para evitar juros, multas e interrupção de serviços."}</span></div>
          </div>` : ""}
          <div class="card">
            <div class="summary-row">
              <div class="mini-stat"><span>Em aberto</span><strong class="${isRec ? "text-green" : "text-red"}">${money(openAll.total)}</strong></div>
              <div class="mini-stat"><span>Títulos abertos</span><strong>${openAll.count}</strong></div>
              <div class="mini-stat"><span>Vencidos</span><strong class="text-red">${money(openAll.overdue.total)}</strong></div>
              <div class="mini-stat"><span>Vencem em 7 dias</span><strong class="text-amber">${money(openAll.soon.total)}</strong></div>
              <div class="mini-stat"><span>${isRec ? "Recebido" : "Pago"} em ${monthLabel(ctx.month, "short")}</span><strong>${money(settledThisMonth)}</strong></div>
            </div>
            <div class="toolbar">
              <div class="search-inline">${icon("search")}<input class="input" id="pend-q" placeholder="Buscar ${article}..."></div>
              <div class="toolbar-end">
                <div class="segmented" id="pend-filter">
                  <button type="button" data-f="open" class="active">Em aberto</button>
                  <button type="button" data-f="overdue">Vencidas</button>
                  <button type="button" data-f="soon">Próximas</button>
                  <button type="button" data-f="settled">Quitadas</button>
                  <button type="button" data-f="all">Todas</button>
                </div>
              </div>
            </div>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Vencimento</th><th>Descrição</th><th>Conta</th><th class="num">Valor</th><th class="num">Baixado</th><th class="num">Em aberto</th><th>Status</th><th class="actions">Ações</th></tr></thead>
                <tbody id="pend-body"></tbody>
              </table>
            </div>
          </div>
          <p class="small muted mt-12">${icon("info")} ${isRec ? "Recebimentos" : "Pagamentos"} parciais são permitidos: cada baixa é registrada separadamente e o restante continua em aberto.</p>
        </div>
      `;
      mount.innerHTML = html;

      const body = mount.querySelector("#pend-body");
      function renderRows() {
        visible = collect();
        body.innerHTML = visible.length
          ? visible.map((t) => {
              const status = C.effectiveStatus(t);
              const paid = C.paidTotal(t);
              const rem = C.remaining(t);
              return `<tr data-open-tx="${t.id}" class="clickable ${rem <= 0 ? "row-muted" : ""}">
                <td class="nowrap">${fmtDate(t.dueDate, "short")}${overdueInfo(t)}</td>
                <td><div class="cell-main">${FM.ui.typeMark(t.type)}
                  <div class="cell-text"><div class="cell-title">${esc(t.description)}</div><div class="cell-sub">${esc(t.category)} › ${esc(t.subcategory)}${t.note ? " · " + esc(t.note) : ""}</div></div>
                </div></td>
                <td class="nowrap small">${esc(C.accountName(t.account))}</td>
                <td class="num amount">${money(t.amount)}</td>
                <td class="num amount muted">${money(paid)}</td>
                <td class="num amount ${rem > 0 ? (isRec ? "pos" : "neg") : "muted"}">${money(rem)}</td>
                <td>${FM.ui.statusBadge(status)}</td>
                <td class="actions">
                  ${C.isOpen(t) ? `<button class="btn sm subtle" data-open-payment="${t.id}">${icon("check")}${verb}</button>` : ""}
                  <button class="icon-btn sm" data-edit-tx="${t.id}" title="Editar">${icon("edit")}</button>
                </td>
              </tr>`;
            }).join("")
          : `<tr><td colspan="8">${FM.ui.emptyState("check-circle", "Nada por aqui", filter === "open" ? `Não há títulos em aberto no momento.` : "Nenhum título corresponde a este filtro.", `<button class="btn sm subtle" data-new-type="${type}">${icon("plus")}Nova ${isRec ? "receita" : "despesa"}</button>`)}</td></tr>`;
      }

      mount.querySelector("#pend-q").addEventListener("input", (e) => { q = e.target.value; renderRows(); });
      mount.querySelectorAll("#pend-filter button").forEach((b) => {
        b.addEventListener("click", () => {
          filter = b.dataset.f;
          mount.querySelectorAll("#pend-filter button").forEach((x) => x.classList.toggle("active", x === b));
          renderRows();
        });
      });
      mount.querySelector("#pend-export").addEventListener("click", () => {
        U.downloadCSV(`luvis-finance-${isRec ? "a-receber" : "a-pagar"}.csv`,
          ["Vencimento", "Descrição", "Categoria", "Conta", "Valor", "Baixado", "Em aberto", "Status"],
          visible.map((t) => [fmtDate(t.dueDate), t.description, `${t.category} › ${t.subcategory}`, C.accountName(t.account), money(t.amount), money(C.paidTotal(t)), money(C.remaining(t)), C.effectiveStatus(t)]));
        FM.ui.toast("Arquivo CSV exportado.");
      });
      renderRows();
    };
  }

  FM.views["a-pagar"] = pendingView("despesa");
  FM.views["a-receber"] = pendingView("receita");

  /* =========================================================
     PARCELAMENTOS
     ========================================================= */
  function openInstallmentForm() {
    const C = FM.calc;
    const body = `
      <div class="form-grid">
        <div class="field"><label>Tipo</label><select class="select" name="type" id="inst-type">
          <option value="despesa">Despesa</option><option value="receita">Receita</option>
        </select></div>
        <div class="field"><label>Descrição</label><input class="input" name="description" placeholder="Ex.: Notebook, curso, equipamento..."></div>
        <div class="field"><label>Valor total</label><div class="money-wrap"><span>R$</span><input class="input money" name="total" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="field"><label>Parcelas</label><input class="input" name="count" type="number" min="2" max="60" value="6"></div>
        <div class="field"><label>1º vencimento</label><input class="input" type="date" name="firstDue" value="${todayISO()}"></div>
        <div class="field"><label>Data de emissão</label><input class="input" type="date" name="date" value="${todayISO()}"></div>
        <div class="field"><label>Categoria</label><select class="select" name="category" id="inst-cat">${FM.ui.categoryOptions("despesa")}</select></div>
        <div class="field"><label>Conta</label><select class="select" name="account">${FM.ui.accountOptions("")}</select></div>
        <div class="field"><label>Centro de custo</label><select class="select" name="costCenter">${FM.ui.costCenterOptions("")}</select></div>
        <div class="field"><label>Forma</label><select class="select" name="method">${FM.ui.methodOptions("Boleto")}</select></div>
      </div>
      <p class="modal-note mt-12">As parcelas são geradas automaticamente na base central, uma por mês, iniciando na data informada. Ajustes individuais podem ser feitos depois em Lançamentos.</p>
    `;
    FM.ui.modalForm({
      title: "Novo parcelamento",
      subtitle: "Geração automática de parcelas mensais",
      body,
      size: "lg",
      submitLabel: "Gerar parcelas",
      submitIcon: "repeat",
      onMount(ov) {
        const typeSel = ov.querySelector("#inst-type");
        const catSel = ov.querySelector("#inst-cat");
        typeSel.addEventListener("change", () => {
          catSel.innerHTML = FM.ui.categoryOptions(typeSel.value);
        });
      },
      onSubmit(fd) {
        const parts = String(fd.get("category") || "").split("||");
        if (!parts[1]) throw new Error("Selecione uma categoria.");
        FM.actions.createInstallmentGroup({
          type: fd.get("type"),
          description: fd.get("description"),
          total: fd.get("total"),
          count: fd.get("count"),
          firstDue: fd.get("firstDue"),
          date: fd.get("date"),
          category: parts[0],
          subcategory: parts[1],
          account: fd.get("account"),
          costCenter: fd.get("costCenter"),
          method: fd.get("method"),
        });
        FM.ui.toast("Parcelamento criado e parcelas geradas.");
      },
    });
  }

  function askCancelGroup(group) {
    FM.ui.modalForm({
      title: "Cancelar parcelamento",
      subtitle: `As parcelas em aberto de "${group.description}" serão canceladas.`,
      body: `<div class="field"><label>Motivo</label><textarea class="textarea" name="reason" placeholder="Ex.: compra devolvida, renegociação..."></textarea></div>
        <p class="modal-note mt-8">Parcelas já pagas são preservadas. O cancelamento fica registrado na auditoria.</p>`,
      submitLabel: "Cancelar parcelamento",
      submitClass: "danger",
      onSubmit(fd) {
        const n = FM.actions.cancelInstallmentGroup(group.id, fd.get("reason"));
        FM.ui.toast(`${n} parcela(s) em aberto cancelada(s).`, "info");
      },
    });
  }

  FM.views.parcelamentos = function (ctx, mount) {
    const C = FM.calc;
    const groups = FM.store.state.installmentGroups.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    let totalOpen = 0, totalPaid = 0, totalValue = 0;
    const cards = groups.map((g) => {
      const txs = C.groupInstallments(g.id);
      let paidSum = 0, openSum = 0, paidCount = 0;
      txs.forEach((t) => {
        paidSum += C.paidTotal(t);
        openSum += C.remaining(t);
        if (C.remaining(t) <= 0.004 && !C.isCancelled(t)) paidCount += 1;
      });
      const total = g.totalAmount || txs.reduce((s, t) => s + U.num(t.amount), 0);
      totalOpen += openSum; totalPaid += paidSum; totalValue += total;
      const pctVal = total ? Math.min(paidSum / total, 1) : 0;
      const next = txs.find((t) => C.isOpen(t));
      const rows = txs.map((t) => {
        const st = C.effectiveStatus(t);
        const label = (t.description.match(/\((\d+\/\d+)\)/) || [])[1] || "—";
        return `<tr data-open-tx="${t.id}" class="clickable ${C.isCancelled(t) ? "row-muted" : ""}">
          <td class="small muted nowrap">${esc(label)}</td>
          <td class="nowrap small">${fmtDate(t.dueDate)}</td>
          <td>${FM.ui.statusBadge(st)}</td>
          <td class="num amount">${money(t.amount)}</td>
          <td class="num small muted">${C.remaining(t) > 0 ? money(C.remaining(t)) : "—"}</td>
        </tr>`;
      }).join("");
      return `<section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${FM.ui.typeMark(g.type)}<span style="margin-left:2px">${esc(g.description)}</span></div>
            <div class="card-sub">${esc(g.category)} › ${esc(g.subcategory)} · ${txs.length} parcelas · ${esc(C.accountName(g.account))}</div>
          </div>
          <span class="badge ${g.cancelled ? "muted" : openSum > 0 ? "primary" : "ok"}">${g.cancelled ? "Cancelado" : openSum > 0 ? "Em andamento" : "Concluído"}</span>
        </div>
        <div class="card-body">
          <div class="budget-nums mb-8"><span>Total <b>${money(total)}</b></span><span>Pago <b>${money(paidSum)}</b> · ${paidCount}/${txs.length}</span></div>
          <div class="progress ${openSum > 0 ? "purple" : "green"}"><span style="width:${(pctVal * 100).toFixed(1)}%"></span></div>
          <div class="row between mt-8 small muted">
            <span>${next ? `Próxima: ${fmtDate(next.dueDate)}` : "Todas as parcelas quitadas"}</span>
            <span>Em aberto: <b class="text-amber">${money(openSum)}</b></span>
          </div>
          <div class="table-wrap mt-12" style="border-top:1px solid var(--border)">
            <table class="data compact"><thead><tr><th>Parcela</th><th>Vencimento</th><th>Status</th><th class="num">Valor</th><th class="num">Aberto</th></tr></thead><tbody>${rows}</tbody></table>
          </div>
          <div class="row between mt-12">
            <a class="card-link" href="#/lancamentos">Abrir em lançamentos ${icon("arrow-right")}</a>
            ${!g.cancelled && openSum > 0 ? `<button class="btn sm danger" data-cancel-group="${g.id}">${icon("x")}Cancelar em aberto</button>` : ""}
          </div>
        </div>
      </section>`;
    }).join("");

    const html = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Parcelamentos</h2><p>Gere e acompanhe compromissos parcelados com vencimentos automáticos.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-inst">${icon("plus")}Novo parcelamento</button></div>
        </div>
        <div class="summary-row" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px">
          <div class="mini-stat"><span>Grupos</span><strong>${groups.length}</strong></div>
          <div class="mini-stat"><span>Valor total</span><strong>${money(totalValue)}</strong></div>
          <div class="mini-stat"><span>Já pago</span><strong class="text-green">${money(totalPaid)}</strong></div>
          <div class="mini-stat"><span>Em aberto</span><strong class="text-amber">${money(totalOpen)}</strong></div>
        </div>
        ${groups.length ? `<div class="grid grid-2">${cards}</div>` : `<div class="card">${FM.ui.emptyState("repeat", "Nenhum parcelamento", "Crie um parcelamento para gerar automaticamente as parcelas mensais na base central.", `<button class="btn primary" id="new-inst-empty">${icon("plus")}Criar parcelamento</button>`)}</div>`}
      </div>
    `;
    mount.innerHTML = html;

    const openForm = () => openInstallmentForm();
    const openers = [mount.querySelector("#new-inst"), mount.querySelector("#new-inst-empty")];
    openers.forEach((b) => b && b.addEventListener("click", openForm));
    mount.querySelectorAll("[data-cancel-group]").forEach((b) => {
      b.addEventListener("click", () => {
        const g = groups.find((x) => x.id === b.dataset.cancelGroup);
        if (g) askCancelGroup(g);
      });
    });
  };
})();

/* =========================================================
   MEU LAR FINANCEIRO — Orçamento, cadastros, DRE, relatórios, guia e configurações
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const { esc, money, moneyShort, pct, fmtDate, fmtDateTime, monthLabel, addMonthsKey, monthKeyOf, todayISO, lastMonthKeys } = U;
  const icon = FM.ui.icon;
  const C = () => FM.calc;
  const st = () => FM.store.state;

  function categoryUsed(name, sub) {
    return st().transactions.some((t) => t.category === name && t.subcategory === sub);
  }

  /* =========================================================
     ORÇAMENTO
     ========================================================= */
  function openBudgetForm(budget, month) {
    const catNames = Array.from(new Set(st().categories.filter((c) => c.type === "Despesa").map((c) => c.name)));
    const body = `
      <div class="form-grid">
        <div class="field"><label>Mês</label><input class="input" type="month" name="month" value="${budget ? budget.month : month}"></div>
        <div class="field"><label>Categoria (despesa)</label><select class="select" name="category">
          ${catNames.length ? catNames.map((n) => `<option ${budget && budget.category === n ? "selected" : ""}>${esc(n)}</option>`).join("") : `<option value="">Cadastre uma categoria de despesa</option>`}
        </select></div>
        <div class="field"><label>Centro de custo</label><select class="select" name="costCenter">${FM.ui.costCenterOptions(budget ? budget.costCenter : "")}</select></div>
        <div class="field"><label>Valor planejado</label><div class="money-wrap"><span>R$</span><input class="input money" name="planned" inputmode="decimal" value="${budget ? String(budget.planned).replace(".", ",") : ""}" placeholder="0,00"></div></div>
      </div>
      <p class="modal-note mt-12">Cada combinação de categoria + centro de custo + mês é única. Deixe o centro vazio para um limite geral da categoria.</p>
    `;
    FM.ui.modalForm({
      title: budget ? "Editar orçamento" : "Novo orçamento",
      subtitle: "Planejado x realizado por categoria e centro de custo",
      body,
      cancelLabel: "Cancelar",
      submitLabel: budget ? "Salvar" : "Adicionar",
      submitIcon: "target",
      onSubmit(fd) {
        FM.actions.saveBudget({
          month: fd.get("month"),
          category: fd.get("category"),
          costCenter: fd.get("costCenter"),
          planned: fd.get("planned"),
        }, budget ? budget.id : null);
        FM.ui.toast(budget ? "Orçamento atualizado." : "Orçamento adicionado.");
      },
    });
  }

  FM.views.orcamento = function (ctx, mount) {
    const calc = C();
    const totals = calc.budgetTotals(ctx.month);
    const rows = totals.rows;
    const prevKey = addMonthsKey(ctx.month, -1);
    const prevCount = st().budgets.filter((b) => b.month === prevKey).length;
    const isCurrent = ctx.month === monthKeyOf(todayISO());
    const daysInMonth = new Date(Number(ctx.month.slice(0, 4)), Number(ctx.month.slice(5, 7)), 0).getDate();
    const pace = isCurrent ? new Date().getDate() / daysInMonth : 1;
    const projected = pace > 0 ? U.round2(totals.actual / pace) : totals.actual;
    const available = U.round2(totals.planned - totals.actual);

    const cards = rows.length
      ? rows.map((r) => {
          const cls = r.critical || r.over ? "red" : r.warning ? "amber" : "green";
          return `<div class="budget-card ${r.over ? "over" : ""}">
            <div class="budget-card-head">
              <div><h4>${esc(r.category)}</h4><span>${esc(r.costCenter || "Todos os centros de custo")}</span></div>
              ${r.critical || r.over ? `<span class="badge danger"><span class="dot"></span>Crítico</span>` : r.warning ? `<span class="badge warn"><span class="dot"></span>Atenção</span>` : `<span class="badge ok"><span class="dot"></span>Dentro</span>`}
            </div>
            <div class="progress tall ${cls}"><span style="width:${Math.min(r.usage * 100, 100).toFixed(1)}%"></span></div>
            <div class="budget-nums"><span>Realizado <b>${money(r.actual)}</b></span><span>Planejado <b>${money(r.planned)}</b></span></div>
            <div class="budget-nums"><span>${r.over ? "Excedeu" : "Disponível"} <b class="${r.over ? "text-red" : "text-green"}">${money(Math.abs(r.remaining))}</b></span><span><b>${pct(r.usage)}</b> usado</span></div>
            <div class="row" style="gap:6px;justify-content:flex-end">
              <button class="btn sm ghost" data-edit-budget="${esc(r.budget.id)}">${icon("edit")}Editar</button>
              <button class="btn sm danger ghost" data-del-budget="${esc(r.budget.id)}">${icon("trash")}</button>
            </div>
          </div>`;
        }).join("")
      : FM.ui.emptyState("target", "Nenhum orçamento neste mês", "Planeje limites por categoria e centro de custo para comparar com o realizado automaticamente.", `<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn primary sm" id="empty-budget">${icon("plus")}Criar orçamento</button>${prevCount ? `<button class="btn sm subtle" id="empty-copy">${icon("repeat")}Copiar de ${esc(monthLabel(prevKey, "short"))}</button>` : ""}</div>`);

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Orçamento</h2><p>Competência de <b>${esc(monthLabel(ctx.month, "long"))}</b> · planejado versus realizado por categoria.</p></div>
          <div class="content-actions">
            ${prevCount ? `<button class="btn ghost sm" id="copy-budget">${icon("repeat")}Copiar mês anterior</button>` : ""}
            <button class="btn primary sm" id="new-budget">${icon("plus")}Novo orçamento</button>
          </div>
        </div>
        <div class="kpi-grid">
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Planejado</span><span class="kpi-icon purple">${icon("target")}</span></div>
            <div class="kpi-value">${money(totals.planned)}</div>
            <div class="kpi-foot"><span>${rows.length} linha(s) de orçamento</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Realizado</span><span class="kpi-icon red">${icon("arrow-down")}</span></div>
            <div class="kpi-value">${money(totals.actual)}</div>
            <div class="kpi-foot"><span>Despesas pagas no mês</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">${available >= 0 ? "Disponível" : "Excedido"}</span><span class="kpi-icon ${available >= 0 ? "green" : "red"}">${icon(available >= 0 ? "wallet" : "alert")}</span></div>
            <div class="kpi-value ${available < 0 ? "neg" : "pos"}">${money(Math.abs(available))}</div>
            <div class="kpi-foot"><span>${totals.planned > 0 ? pct(totals.usage) + " do plano utilizado" : "Defina um planejado para calcular"}</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Projeção de fechamento</span><span class="kpi-icon amber">${icon("clock")}</span></div>
            <div class="kpi-value ${totals.planned > 0 && projected > totals.planned ? "neg" : ""}">${money(projected)}</div>
            <div class="kpi-foot"><span>${isCurrent ? "No ritmo atual de gastos" : "Mês encerrado — realizado final"}</span></div>
          </article>
        </div>
        ${totals.planned > 0 && projected > totals.planned + 0.004 ? `<div class="alert-strip warn mt-16"><div class="alert-icon">${icon("alert")}</div><div class="alert-text"><strong>Ritmo de gastos acima do planejado</strong><span>Mantendo este ritmo, o mês fechará em ${money(projected)} contra ${money(totals.planned)} planejados. Reveja as categorias com maior consumo.</span></div></div>` : ""}
        <div class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("target")}Planejado x realizado</div><div class="card-sub">Consumo de cada linha de orçamento</div></div></div>
          <div class="card-body">
            <div class="budget-card-grid">${cards}</div>
          </div>
        </div>
        <div class="grid grid-2 mt-16">
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("sparkles")}Como usar o orçamento</div>
            <ul class="tip-list mt-8">
              <li>Comece pelo histórico: use a média dos últimos 3 meses como base para cada categoria.</li>
              <li>Defina limites por <b>centro de custo</b> quando mais de uma área compartilha a mesma categoria.</li>
              <li>Acompanhe toda semana. Estourou? Reduza gastos discricionários, não apenas o planejado.</li>
              <li>O realizado considera apenas despesas <b>pagas</b> no mês (regime de caixa).</li>
            </ul>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("arrow-right")}Próximos meses</div>
            <div class="mt-8" style="display:grid;gap:8px">
              ${[1, 2].map((off) => {
                const k = addMonthsKey(ctx.month, off);
                const t = calc.budgetTotals(k);
                return `<div class="row between"><a class="card-link" href="#" data-goto-month="${k}">${esc(monthLabel(k, "long"))} ${icon("arrow-right")}</a><span class="small muted">${t.planned > 0 ? `Planejado ${moneyShort(t.planned)}` : "Sem orçamento definido"}</span></div>`;
              }).join("")}
            </div>
            <p class="small muted mt-12">Copie o orçamento do mês anterior e ajuste apenas o que mudou — leva segundos e mantém a disciplina.</p>
          </div></div>
        </div>
      </div>
    `;

    const open = () => openBudgetForm(null, ctx.month);
    ["#new-budget", "#empty-budget"].forEach((sel) => {
      const b = mount.querySelector(sel);
      if (b) b.addEventListener("click", open);
    });
    const copyBtn = mount.querySelector("#copy-budget") || mount.querySelector("#empty-copy");
    if (copyBtn) copyBtn.addEventListener("click", () => {
      try {
        const n = FM.actions.copyBudgets(prevKey, ctx.month);
        FM.ui.toast(n ? `${n} linha(s) copiada(s) de ${monthLabel(prevKey, "long")}.` : "O mês já tem todas as linhas do mês anterior.", n ? "success" : "info");
      } catch (err) { FM.ui.toast(err.message, "error"); }
    });
    mount.querySelectorAll("[data-edit-budget]").forEach((b) => {
      b.addEventListener("click", () => {
        const budget = st().budgets.find((x) => x.id === b.dataset.editBudget);
        if (budget) openBudgetForm(budget, ctx.month);
      });
    });
    mount.querySelectorAll("[data-del-budget]").forEach((b) => {
      b.addEventListener("click", async () => {
        const budget = st().budgets.find((x) => x.id === b.dataset.delBudget);
        if (!budget) return;
        const ok = await FM.ui.confirm({
          title: "Excluir orçamento",
          message: `A linha "${esc(budget.category)}${budget.costCenter ? " · " + esc(budget.costCenter) : ""}" de ${esc(monthLabel(budget.month))} será removida.`,
          confirmLabel: "Excluir",
          danger: true,
        });
        if (!ok) return;
        FM.actions.deleteBudget(budget.id);
        FM.ui.toast("Orçamento excluído.", "info");
      });
    });
    mount.querySelectorAll("[data-goto-month]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        FM.store.setMonth(a.dataset.gotoMonth);
        FM.app.renderCurrent();
      });
    });
  };

  /* =========================================================
     CATEGORIAS
     ========================================================= */
  function openCategoryForm(cat) {
    const names = Array.from(new Set(st().categories.map((c) => c.name)));
    const used = cat ? categoryUsed(cat.name, cat.subcategory) : false;
    const body = `
      <div class="form-grid">
        <div class="field"><label>Categoria</label><input class="input" name="name" list="cat-names" value="${cat ? esc(cat.name) : ""}" placeholder="Ex.: Mercado"><datalist id="cat-names">${names.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist></div>
        <div class="field"><label>Subcategoria</label><input class="input" name="subcategory" value="${cat ? esc(cat.subcategory) : ""}" placeholder="Ex.: Aluguel"></div>
        <div class="field"><label>Tipo</label><select class="select" name="type">
          <option value="Despesa" ${cat && cat.type === "Despesa" ? "selected" : ""}>Despesa</option>
          <option value="Receita" ${cat && cat.type === "Receita" ? "selected" : ""}>Receita</option>
        </select></div>
        <div class="field"><label>Descrição</label><input class="input" name="description" value="${cat ? esc(cat.description) : ""}" placeholder="Para que serve esta categoria"></div>
      </div>
      ${used ? `<div class="analytics-callout mt-12">${icon("info")}<span>Categoria em uso por lançamentos: <b>nome e subcategoria não podem ser renomeados</b>. Você ainda pode alterar a descrição.</span></div>` : ""}
    `;
    FM.ui.modalForm({
      title: cat ? "Editar categoria" : "Nova categoria",
      subtitle: "Organização das receitas e despesas",
      body,
      submitLabel: cat ? "Salvar" : "Criar categoria",
      submitIcon: "tag",
      onSubmit(fd) {
        FM.actions.saveCategory({
          name: String(fd.get("name") || "").trim(),
          subcategory: String(fd.get("subcategory") || "").trim(),
          type: fd.get("type"),
          description: fd.get("description"),
        }, cat ? cat.id : null);
        FM.ui.toast(cat ? "Categoria atualizada." : "Categoria criada.");
      },
    });
  }

  FM.views.categorias = function (ctx, mount) {
    const calc = C();
    let query = "";
    let typeFilter = "all";
    const cats = st().categories.slice().sort((a, b) => a.name.localeCompare(b.name) || a.subcategory.localeCompare(b.subcategory));

    function visible() {
      return cats.filter((c) => {
        if (typeFilter !== "all" && c.type !== typeFilter) return false;
        if (!query) return true;
        return [c.name, c.subcategory, c.description].join(" ").toLowerCase().includes(query.toLowerCase());
      });
    }

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Categorias e subcategorias</h2><p>Padronize a classificação para relatórios e orçamento confiáveis.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-cat">${icon("plus")}Nova categoria</button></div>
        </div>
        <div class="card">
          <div class="toolbar">
            <div class="search-inline">${icon("search")}<input class="input" id="cat-q" placeholder="Buscar categoria..."></div>
            <div class="toolbar-end">
              <div class="segmented" id="cat-type">
                <button type="button" data-t="all" class="active">Todas</button>
                <button type="button" data-t="Despesa">Despesas</button>
                <button type="button" data-t="Receita">Receitas</button>
              </div>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Categoria</th><th>Subcategoria</th><th>Tipo</th><th>Descrição</th><th class="num">Lançamentos</th><th class="num">No mês</th><th class="actions">Ações</th></tr></thead>
              <tbody id="cat-body"></tbody>
            </table>
          </div>
        </div>
        <p class="small muted mt-12">${icon("info")} Categorias em uso não podem ser excluídas nem renomeadas — isso preserva a consistência histórica dos relatórios.</p>
      </div>
    `;

    const body = mount.querySelector("#cat-body");
    function render() {
      const list = visible();
      body.innerHTML = list.length
        ? list.map((c) => {
            const count = st().transactions.filter((t) => t.category === c.name && t.subcategory === c.subcategory).length;
            const monthSum = st().transactions.reduce((s, t) => {
              if (t.category !== c.name || t.subcategory !== c.subcategory || calc.isCancelled(t)) return s;
              (t.payments || []).forEach((p) => { if (monthKeyOf(p.date) === ctx.month) s += U.num(p.amount); });
              return s;
            }, 0);
            return `<tr>
              <td><b>${esc(c.name)}</b></td>
              <td>${esc(c.subcategory)}</td>
              <td><span class="badge ${c.type === "Receita" ? "ok" : "danger"}">${esc(c.type)}</span></td>
              <td class="small muted">${esc(c.description || "—")}</td>
              <td class="num">${count}</td>
              <td class="num amount ${c.type === "Receita" ? "pos" : "neg"}">${money(monthSum)}</td>
              <td class="actions">
                <button class="icon-btn sm" data-edit-cat="${esc(c.id)}" title="Editar">${icon("edit")}</button>
                <button class="icon-btn sm danger" data-del-cat="${esc(c.id)}" title="Excluir">${icon("trash")}</button>
              </td>
            </tr>`;
          }).join("")
        : `<tr><td colspan="7">${FM.ui.emptyState("tag", "Nenhuma categoria encontrada", query ? "Ajuste a busca ou cadastre a categoria desejada." : "Cadastre categorias para classificar os lançamentos.", `<button class="btn sm subtle" id="empty-cat">${icon("plus")}Nova categoria</button>`)}</td></tr>`;
      const b = body.querySelector("#empty-cat");
      if (b) b.addEventListener("click", () => openCategoryForm(null));
      bindRows();
    }
    function bindRows() {
      body.querySelectorAll("[data-edit-cat]").forEach((b) => {
        b.addEventListener("click", () => {
          const cat = cats.find((c) => c.id === b.dataset.editCat);
          if (cat) openCategoryForm(cat);
        });
      });
      body.querySelectorAll("[data-del-cat]").forEach((b) => {
        b.addEventListener("click", async () => {
          const cat = cats.find((c) => c.id === b.dataset.delCat);
          if (!cat) return;
          const ok = await FM.ui.confirm({
            title: "Excluir categoria",
            message: `Excluir "${esc(cat.name)} › ${esc(cat.subcategory)}"? Só é permitido se não houver lançamentos nem orçamentos vinculados.`,
            confirmLabel: "Excluir",
            danger: true,
          });
          if (!ok) return;
          try {
            FM.actions.deleteCategory(cat.id);
            FM.ui.toast("Categoria excluída.", "info");
          } catch (err) { FM.ui.toast(err.message, "error"); }
        });
      });
    }

    mount.querySelector("#cat-q").addEventListener("input", (e) => { query = e.target.value; render(); });
    mount.querySelectorAll("#cat-type button").forEach((b) => {
      b.addEventListener("click", () => {
        typeFilter = b.dataset.t;
        mount.querySelectorAll("#cat-type button").forEach((x) => x.classList.toggle("active", x === b));
        render();
      });
    });
    mount.querySelector("#new-cat").addEventListener("click", () => openCategoryForm(null));
    render();
  };

  /* =========================================================
     CENTROS DE CUSTO
     ========================================================= */
  function openCostCenterForm(cc) {
    const body = `
      <div class="form-grid">
        <div class="field"><label>Nome</label><input class="input" name="name" value="${cc ? esc(cc.name) : ""}" placeholder="Ex.: Operacional"></div>
        <div class="field"><label>Responsável</label><input class="input" name="owner" value="${cc ? esc(cc.owner) : ""}" placeholder="Quem acompanha este centro"></div>
        <div class="field"><label>Orçamento mensal de referência</label><div class="money-wrap"><span>R$</span><input class="input money" name="monthlyBudget" inputmode="decimal" value="${cc ? String(cc.monthlyBudget).replace(".", ",") : ""}" placeholder="0,00"></div></div>
        <div class="field"><label>Observação</label><input class="input" name="note" value="${cc ? esc(cc.note) : ""}" placeholder="Opcional"></div>
      </div>
    `;
    FM.ui.modalForm({
      title: cc ? "Editar centro de custo" : "Novo centro de custo",
      subtitle: "Áreas que consomem orçamento",
      body,
      submitLabel: cc ? "Salvar" : "Criar centro",
      submitIcon: "briefcase",
      onSubmit(fd) {
        FM.actions.saveCostCenter({
          name: fd.get("name"),
          owner: fd.get("owner"),
          monthlyBudget: fd.get("monthlyBudget"),
          note: fd.get("note"),
        }, cc ? cc.id : null);
        FM.ui.toast(cc ? "Centro de custo atualizado." : "Centro de custo criado.");
      },
    });
  }

  FM.views.centros = function (ctx, mount) {
    const calc = C();
    const notifications = calc.notificationSettings();
    const centers = st().costCenters;
    const spendByCenter = new Map();
    calc.paymentsInMonth({ month: ctx.month, type: "despesa" }).forEach(({ tx, payment }) => {
      const key = tx.costCenter || "Sem centro";
      spendByCenter.set(key, roundSum(spendByCenter.get(key), U.num(payment.amount)));
    });
    function roundSum(prev, add) { return U.round2((prev || 0) + add); }

    const totalBudget = centers.reduce((s, c) => s + U.num(c.monthlyBudget), 0);
    const totalSpend = Array.from(spendByCenter.values()).reduce((s, v) => s + v, 0);

    const cards = centers.map((c) => {
      const spent = spendByCenter.get(c.name) || 0;
      const budget = U.num(c.monthlyBudget);
      const usage = budget > 0 ? spent / budget : 0;
      const count = st().transactions.filter((t) => t.costCenter === c.name && !calc.isCancelled(t)).length;
      return `<div class="budget-card ${budget > 0 && usage > 1 ? "over" : ""}">
        <div class="budget-card-head">
          <div><h4>${esc(c.name)}</h4><span>${esc(c.owner || "Sem responsável")} · ${count} lançamento(s)</span></div>
          ${budget > 0 ? `<span class="badge ${usage >= notifications.budgetCritical / 100 ? "danger" : usage >= notifications.budgetWarning / 100 ? "warn" : "ok"}">${pct(usage)}</span>` : `<span class="badge muted">Sem referência</span>`}
        </div>
        <div class="progress tall ${budget > 0 && usage >= notifications.budgetCritical / 100 ? "red" : usage >= notifications.budgetWarning / 100 ? "amber" : "green"}"><span style="width:${Math.min(usage * 100, 100).toFixed(1)}%"></span></div>
        <div class="budget-nums"><span>Gasto no mês <b>${money(spent)}</b></span><span>Referência <b>${budget > 0 ? money(budget) : "—"}</b></span></div>
        ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
        <div class="row" style="gap:6px;justify-content:flex-end">
          <button class="btn sm ghost" data-edit-cc="${esc(c.id)}">${icon("edit")}Editar</button>
          <button class="btn sm danger ghost" data-del-cc="${esc(c.id)}">${icon("trash")}</button>
        </div>
      </div>`;
    }).join("");

    const chartLabels = centers.map((c) => c.name);
    const chartPlanned = centers.map((c) => U.num(c.monthlyBudget));
    const chartActual = centers.map((c) => spendByCenter.get(c.name) || 0);

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Centros de custo</h2><p>Separe despesas por área, projeto ou responsável para enxergar quem consome o orçamento.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-cc">${icon("plus")}Novo centro</button></div>
        </div>
        <div class="summary-row" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;padding:14px 18px">
          <div class="mini-stat"><span>Centros cadastrados</span><strong>${centers.length}</strong></div>
          <div class="mini-stat"><span>Referência mensal somada</span><strong>${money(totalBudget)}</strong></div>
          <div class="mini-stat"><span>Despesas pagas em ${esc(monthLabel(ctx.month, "short"))}</span><strong class="text-red">${money(totalSpend)}</strong></div>
          <div class="mini-stat"><span>Sem centro de custo</span><strong class="text-amber">${money(spendByCenter.get("Sem centro") || 0)}</strong></div>
        </div>
        ${centers.length ? `<div class="budget-card-grid">${cards}</div>` : `<div class="card">${FM.ui.emptyState("briefcase", "Nenhum centro de custo", "Centros ajudam a separar gastos de áreas ou projetos e a definir responsáveis.", `<button class="btn primary" id="empty-cc">${icon("plus")}Criar centro de custo</button>`)}</div>`}
        <div class="grid grid-main mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("scale")}Referência x gasto no mês</div><div class="card-sub">Compare o orçamento de referência com as despesas pagas</div></div></div>
            <div class="card-body">
              ${centers.length ? FM.charts.bars({
                labels: chartLabels,
                series: [
                  { name: "Referência mensal", values: chartPlanned, color: "#d96faa" },
                  { name: "Gasto realizado", values: chartActual, color: "#e27c94" },
                ],
                height: 250,
              }) + FM.charts.legend([{ name: "Referência mensal", color: "#d96faa" }, { name: "Despesas pagas", color: "#e27c94" }]) : FM.ui.emptyState("briefcase", "Sem dados", "Cadastre centros de custo para comparar o planejado com o realizado.")}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("info")}Boas práticas</div><div class="card-sub">Como usar centros de custo</div></div></div>
            <div class="card-body">
              <ul class="tip-list">
                <li>Todo lançamento relevante deve ter um centro de custo; “sem centro” esconde a origem do gasto.</li>
                <li>Use o <b>orçamento</b> por categoria + centro para limites específicos; a referência mensal aqui é um indicador rápido.</li>
                <li>Renomear um centro atualiza automaticamente lançamentos e orçamentos vinculados.</li>
                <li>Centros em uso não podem ser excluídos — desative-os mudando o nome para “Encerrado: …” se necessário.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    `;

    const open = () => openCostCenterForm(null);
    ["#new-cc", "#empty-cc"].forEach((sel) => {
      const b = mount.querySelector(sel);
      if (b) b.addEventListener("click", open);
    });
    mount.querySelectorAll("[data-edit-cc]").forEach((b) => {
      b.addEventListener("click", () => {
        const cc = centers.find((c) => c.id === b.dataset.editCc);
        if (cc) openCostCenterForm(cc);
      });
    });
    mount.querySelectorAll("[data-del-cc]").forEach((b) => {
      b.addEventListener("click", async () => {
        const cc = centers.find((c) => c.id === b.dataset.delCc);
        if (!cc) return;
        const ok = await FM.ui.confirm({
          title: "Excluir centro de custo",
          message: `Excluir "${esc(cc.name)}"? Só é permitido se não houver lançamentos nem orçamentos vinculados.`,
          confirmLabel: "Excluir",
          danger: true,
        });
        if (!ok) return;
        try {
          FM.actions.deleteCostCenter(cc.id);
          FM.ui.toast("Centro de custo excluído.", "info");
        } catch (err) { FM.ui.toast(err.message, "error"); }
      });
    });
  };

  /* =========================================================
     DRE GERENCIAL
     ========================================================= */
  FM.views.dre = function (ctx, mount) {
    const calc = C();
    const month = ctx.month;
    const s = calc.monthStats(month);
    const prevKey = addMonthsKey(month, -1);
    const prev = calc.monthStats(prevKey);
    const income = calc.categoryIncome(month);
    const spend = calc.categorySpend(month, "despesa");
    const totalIncome = s.receitasRecebidas;
    const totalSpend = s.despesasPagas;
    const margin = totalIncome > 0 ? s.resultado / totalIncome : 0;

    const ccMap = new Map();
    calc.paymentsInMonth({ month, cashOnly: true }).forEach(({ tx, payment }) => {
      const key = tx.costCenter || "Sem centro";
      const cur = ccMap.get(key) || { name: key, rec: 0, desp: 0 };
      if (tx.type === "receita") cur.rec += U.num(payment.amount);
      else cur.desp += U.num(payment.amount);
      ccMap.set(key, cur);
    });
    const ccRows = Array.from(ccMap.values()).sort((a, b) => b.desp - a.desp);

    const keys6 = lastMonthKeys(6, month);
    const stats6 = calc.monthlySeries(keys6);

    function line(label, value, total, tone) {
      const share = total > 0 ? value / total : 0;
      return `<tr>
        <td>${esc(label)}</td>
        <td class="num amount ${tone || ""}">${money(value)}</td>
        <td class="num small muted">${pct(share)}</td>
        <td style="width:34%"><div class="progress ${tone === "neg" ? "red" : "green"}"><span style="width:${Math.min(share * 100, 100).toFixed(1)}%"></span></div></td>
      </tr>`;
    }

    const incomeRows = income.length ? income.map((c) => line(c.name, c.total, totalIncome, "pos")).join("") : `<tr><td colspan="4" class="small muted">Nenhuma receita recebida no mês.</td></tr>`;
    const spendRows = spend.length ? spend.map((c) => line(c.name, c.total, totalSpend, "neg")).join("") : `<tr><td colspan="4" class="small muted">Nenhuma despesa paga no mês.</td></tr>`;
    const ccTable = ccRows.length
      ? ccRows.map((c) => `<tr><td>${esc(c.name)}</td><td class="num amount pos">${money(c.rec)}</td><td class="num amount neg">${money(c.desp)}</td><td class="num amount ${c.rec - c.desp >= 0 ? "pos" : "neg"}">${money(c.rec - c.desp)}</td></tr>`).join("")
      : `<tr><td colspan="4" class="small muted">Sem movimentações realizadas no período.</td></tr>`;

    const resultTone = s.resultado >= 0 ? "positive" : "danger";
    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>DRE gerencial</h2><p>Demonstrativo de resultado de <b>${esc(monthLabel(month, "long"))}</b> pelo regime de caixa (valores efetivamente recebidos e pagos).</p></div>
          <div class="content-actions">
            <button class="btn ghost sm" id="dre-print">${icon("printer")}Imprimir</button>
            <button class="btn ghost sm" id="dre-export">${icon("download")}Exportar</button>
          </div>
        </div>
        <div class="print-head"><strong>DRE gerencial — ${esc(monthLabel(month, "long"))}</strong><span>Meu Lar Financeiro · regime de caixa · gerado em ${fmtDate(todayISO())}</span></div>

        <div class="grid grid-3">
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Receitas recebidas</span><span class="kpi-icon green">${icon("arrow-up")}</span></div>
            <div class="kpi-value">${money(totalIncome)}</div>
            <div class="kpi-foot"><span>${income.length} categoria(s) com recebimento</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Despesas pagas</span><span class="kpi-icon red">${icon("arrow-down")}</span></div>
            <div class="kpi-value">${money(totalSpend)}</div>
            <div class="kpi-foot"><span>${spend.length} categoria(s) com pagamento</span></div>
          </article>
          <article class="kpi hero">
            <div class="kpi-head"><span class="kpi-label">Resultado do período</span><span class="kpi-icon ${s.resultado >= 0 ? "green" : "red"}">${icon(s.resultado >= 0 ? "trending-up" : "trending-down")}</span></div>
            <div class="kpi-value ${s.resultado >= 0 ? "pos" : "neg"}">${money(s.resultado)}</div>
            <div class="kpi-foot"><span>Margem de ${pct(margin)} · anterior: ${money(prev.resultado)}</span></div>
          </article>
        </div>

        <div class="grid grid-main mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("file")}Demonstrativo</div><div class="card-sub">Receitas, despesas e resultado em ${esc(monthLabel(month, "long"))}</div></div></div>
            <div class="card-body flush">
              <table class="data">
                <thead><tr><th>Receitas</th><th class="num">Valor</th><th class="num">%</th><th></th></tr></thead>
                <tbody>${incomeRows}
                  <tr><td><b>Total de receitas</b></td><td class="num amount pos"><b>${money(totalIncome)}</b></td><td class="num">100%</td><td></td></tr>
                </tbody>
              </table>
              <table class="data" style="margin-top:4px">
                <thead><tr><th>Despesas</th><th class="num">Valor</th><th class="num">%</th><th></th></tr></thead>
                <tbody>${spendRows}
                  <tr><td><b>Total de despesas</b></td><td class="num amount neg"><b>${money(totalSpend)}</b></td><td class="num">100%</td><td></td></tr>
                </tbody>
                <tfoot><tr>
                  <td><b>Resultado (receitas − despesas)</b></td>
                  <td class="num amount ${s.resultado >= 0 ? "pos" : "neg"}"><b>${money(s.resultado)}</b></td>
                  <td class="num"><b>${pct(margin)}</b></td><td></td>
                </tr></tfoot>
              </table>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("sparkles")}Leitura do resultado</div><div class="card-sub">Interpretação automática</div></div></div>
            <div class="card-body">
              <div class="insight">
                <div class="insight-icon ${resultTone}">${icon(s.resultado >= 0 ? "trending-up" : "trending-down")}</div>
                <div class="insight-body">
                  <strong>${s.resultado >= 0 ? "Resultado positivo" : "Resultado negativo"} de ${money(Math.abs(s.resultado))}</strong>
                  <p>${s.resultado >= 0 ? `A organização recebeu mais do que pagou e gerou margem de ${pct(margin)} no mês.` : `As despesas pagas superaram as receitas recebidas. Revise custos fixos e antecipe cobranças.`} Comparado a ${esc(monthLabel(prevKey, "long"))}, a variação foi de ${money(s.resultado - prev.resultado)}.</p>
                </div>
              </div>
              ${spend.length ? `<div class="insight"><div class="insight-icon tip">${icon("pie")}</div><div class="insight-body"><strong>Maior despesa: ${esc(spend[0].name)}</strong><p>Representa ${pct(totalSpend > 0 ? spend[0].total / totalSpend : 0)} das despesas pagas (${money(spend[0].total)}). Concentração alta pede negociação e alternativas de fornecedor.</p></div></div>` : ""}
              <div class="insight"><div class="insight-icon info">${icon("clock")}</div><div class="insight-body"><strong>Compromissos futuros</strong><p>Há ${calc.openTotals("despesa").count} conta(s) a pagar (${money(calc.openTotals("despesa").total)}) e ${calc.openTotals("receita").count} a receber (${money(calc.openTotals("receita").total)}). O resultado realizado não reflete esses valores até a baixa.</p></div></div>
              <p class="small muted mt-12">Este DRE é gerencial e usa regime de caixa. Não substitui a contabilidade formal nem apuração fiscal.</p>
            </div>
          </section>
        </div>

        <div class="grid grid-2 mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("briefcase")}Resultado por centro de custo</div><div class="card-sub">Receitas e despesas realizadas por área</div></div></div>
            <div class="card-body flush">
              <div class="table-wrap"><table class="data"><thead><tr><th>Centro</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Resultado</th></tr></thead><tbody>${ccTable}</tbody></table></div>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("trending-up")}Resultado dos últimos 6 meses</div><div class="card-sub">Evolução do resultado realizado</div></div></div>
            <div class="card-body">
              ${FM.charts.area({ labels: stats6.map((x) => x.label), series: [{ name: "Resultado", values: stats6.map((x) => x.resultado), color: "#aa88cf", fill: true }], height: 236, zero: false })}
              ${FM.charts.legend([{ name: "Resultado mensal", color: "#aa88cf" }])}
            </div>
          </section>
        </div>

        <div class="card mt-16"><div class="card-body">
          <div class="card-title">${icon("info")}Como interpretar</div>
          <ul class="tip-list mt-8">
            <li><b>Regime de caixa</b>: entram apenas valores recebidos e pagos no mês, mesmo que o lançamento seja de outro período.</li>
            <li><b>Margem</b> = resultado ÷ receitas recebidas. Queda de margem com receita estável indica aumento de custos.</li>
            <li><b>Reserva</b>: resultado positivo recorrente deve financiar reserva (3–6 meses) antes de novos investimentos.</li>
            <li>Use o DRE junto com o fluxo de caixa: resultado positivo não garante liquidez se recebimentos atrasarem.</li>
          </ul>
        </div></div>
      </div>
    `;

    mount.querySelector("#dre-print").addEventListener("click", () => window.print());
    mount.querySelector("#dre-export").addEventListener("click", () => {
      const rows = [
        ["DRE gerencial", monthLabel(month, "long")],
        [],
        ["Receitas", "Valor"],
        ...income.map((c) => [c.name, money(c.total)]),
        ["Total de receitas", money(totalIncome)],
        [],
        ["Despesas", "Valor"],
        ...spend.map((c) => [c.name, money(c.total)]),
        ["Total de despesas", money(totalSpend)],
        [],
        ["Resultado", money(s.resultado)],
        ["Margem", pct(margin)],
        [],
        ["Centro de custo", "Receitas", "Despesas", "Resultado"],
        ...ccRows.map((c) => [c.name, money(c.rec), money(c.desp), money(c.rec - c.desp)]),
      ];
      U.downloadCSV(`meu-lar-financeiro-dre-${month}.csv`, ["Indicador", "Valor"], rows);
      FM.ui.toast("DRE exportado em CSV.");
    });
  };

  /* =========================================================
     RELATÓRIOS
     ========================================================= */
  FM.views.relatorios = function (ctx, mount) {
    const calc = C();
    const month = ctx.month;
    const s = calc.monthStats(month);
    const pay = calc.openTotals("despesa");
    const rec = calc.openTotals("receita");
    const budgets = calc.budgetTotals(month);
    const income = calc.categoryIncome(month);
    const spend = calc.categorySpend(month, "despesa");
    const accounts = st().accounts;

    const cards = [
      { key: "resumo", icon: "dashboard", title: "Resumo executivo", desc: "Indicadores do mês, resultado, saldos e próximos vencimentos." },
      { key: "lancamentos", icon: "receipt", title: "Lançamentos do período", desc: "Todas as operações do mês com categoria, conta e status." },
      { key: "abertos", icon: "clock", title: "Contas em aberto", desc: "Títulos a pagar e a receber ainda não baixados." },
      { key: "categorias", icon: "pie", title: "Categorias", desc: "Receitas e despesas realizadas agrupadas por categoria." },
      { key: "orcamento", icon: "target", title: "Orçamento", desc: "Planejado versus realizado por categoria e centro." },
      { key: "fluxo", icon: "trending-up", title: "Fluxo de caixa", desc: "12 meses de realizado e projeção de caixa." },
      { key: "contas", icon: "bank", title: "Saldos por conta", desc: "Saldo atual, entradas e saídas de cada conta." },
      { key: "dre", icon: "file", title: "DRE gerencial", desc: "Receitas, despesas, resultado e margem do mês." },
    ];

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Relatórios</h2><p>Relatório gerencial de <b>${esc(monthLabel(month, "long"))}</b> em PDF, Excel e CSV.</p></div>
          <div class="content-actions">
            <button class="btn ghost sm" id="rep-print">${icon("printer")}Imprimir / PDF</button>
            <button class="btn primary sm" id="rep-xlsx">${icon("download")}Excel</button>
          </div>
        </div>
        <div class="print-head"><strong>Relatório gerencial — ${esc(monthLabel(month, "long"))}</strong><span>${esc(st().meta.name || "Meu Lar Financeiro")} · gerado em ${fmtDate(todayISO())}</span></div>

        <div class="kpi-grid">
          <article class="kpi"><div class="kpi-head"><span class="kpi-label">Receitas recebidas</span><span class="kpi-icon green">${icon("arrow-up")}</span></div><div class="kpi-value">${money(s.receitasRecebidas)}</div><div class="kpi-foot"><span>${income.length} categorias</span></div></article>
          <article class="kpi"><div class="kpi-head"><span class="kpi-label">Despesas pagas</span><span class="kpi-icon red">${icon("arrow-down")}</span></div><div class="kpi-value">${money(s.despesasPagas)}</div><div class="kpi-foot"><span>${spend.length} categorias</span></div></article>
          <article class="kpi"><div class="kpi-head"><span class="kpi-label">Resultado</span><span class="kpi-icon ${s.resultado >= 0 ? "green" : "red"}">${icon(s.resultado >= 0 ? "trending-up" : "trending-down")}</span></div><div class="kpi-value ${s.resultado >= 0 ? "pos" : "neg"}">${money(s.resultado)}</div><div class="kpi-foot"><span>Margem ${pct(s.receitasRecebidas ? s.resultado / s.receitasRecebidas : 0)}</span></div></article>
          <article class="kpi"><div class="kpi-head"><span class="kpi-label">Saldo disponível</span><span class="kpi-icon cyan">${icon("wallet")}</span></div><div class="kpi-value">${money(calc.consolidatedBalance())}</div><div class="kpi-foot"><span>${accounts.length} conta(s)</span></div></article>
        </div>

        <div class="grid grid-2 mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("pie")}Despesas por categoria</div><div class="card-sub">Valores pagos em ${esc(monthLabel(month, "long"))}</div></div></div>
            <div class="card-body flush">
              <table class="data compact"><thead><tr><th>Categoria</th><th class="num">Valor</th><th class="num">% do total</th></tr></thead>
              <tbody>${spend.length ? spend.map((c) => `<tr><td>${esc(c.name)}</td><td class="num amount neg">${money(c.total)}</td><td class="num">${pct(s.despesasPagas ? c.total / s.despesasPagas : 0)}</td></tr>`).join("") : `<tr><td colspan="3" class="small muted">Sem despesas pagas no mês.</td></tr>`}</tbody>
              <tfoot><tr><td>Total</td><td class="num">${money(s.despesasPagas)}</td><td class="num">100%</td></tr></tfoot></table>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("target")}Orçamento do mês</div><div class="card-sub">Planejado versus realizado</div></div></div>
            <div class="card-body flush">
              <table class="data compact"><thead><tr><th>Categoria</th><th class="num">Planejado</th><th class="num">Realizado</th><th class="num">Uso</th></tr></thead>
              <tbody>${budgets.rows.length ? budgets.rows.map((r) => `<tr><td>${esc(r.category)}<div class="cell-sub">${esc(r.costCenter || "Todos os centros")}</div></td><td class="num">${money(r.planned)}</td><td class="num amount ${r.over ? "neg" : ""}">${money(r.actual)}</td><td class="num">${pct(r.usage)}</td></tr>`).join("") : `<tr><td colspan="4" class="small muted">Nenhum orçamento definido neste mês.</td></tr>`}</tbody>
              <tfoot><tr><td>Total</td><td class="num">${money(budgets.planned)}</td><td class="num">${money(budgets.actual)}</td><td class="num">${pct(budgets.usage)}</td></tr></tfoot></table>
            </div>
          </section>
        </div>

        <div class="grid grid-2 mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("arrow-down")}Contas a pagar em aberto</div><div class="card-sub">${pay.count} título(s) · ${money(pay.total)}</div></div></div>
            <div class="card-body flush">
              <table class="data compact"><thead><tr><th>Vencimento</th><th>Descrição</th><th class="num">Em aberto</th><th>Status</th></tr></thead>
              <tbody>${st().transactions.filter((t) => t.type === "despesa" && calc.isOpen(t)).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).slice(0, 8).map((t) => `<tr><td class="nowrap">${fmtDate(t.dueDate)}</td><td>${esc(t.description)}</td><td class="num amount">${money(calc.remaining(t))}</td><td>${FM.ui.statusBadge(calc.effectiveStatus(t))}</td></tr>`).join("") || `<tr><td colspan="4" class="small muted">Nenhuma conta em aberto.</td></tr>`}</tbody></table>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("arrow-up")}Contas a receber em aberto</div><div class="card-sub">${rec.count} título(s) · ${money(rec.total)}</div></div></div>
            <div class="card-body flush">
              <table class="data compact"><thead><tr><th>Vencimento</th><th>Descrição</th><th class="num">Em aberto</th><th>Status</th></tr></thead>
              <tbody>${st().transactions.filter((t) => t.type === "receita" && calc.isOpen(t)).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).slice(0, 8).map((t) => `<tr><td class="nowrap">${fmtDate(t.dueDate)}</td><td>${esc(t.description)}</td><td class="num amount">${money(calc.remaining(t))}</td><td>${FM.ui.statusBadge(calc.effectiveStatus(t))}</td></tr>`).join("") || `<tr><td colspan="4" class="small muted">Nenhum recebível em aberto.</td></tr>`}</tbody></table>
            </div>
          </section>
        </div>

        <div class="grid grid-3 mt-16 no-print" id="report-grid">
          ${cards.map((c) => `<button class="report-card" data-report="${c.key}">
            <span class="report-icon">${icon(c.icon)}</span>
            <span class="report-text"><strong>${esc(c.title)}</strong><span>${esc(c.desc)}</span></span>
            <span class="report-action">${icon("download")}</span>
          </button>`).join("")}
        </div>
        <p class="small muted mt-12 no-print">${icon("info")} Os arquivos CSV abrem no Excel e usam ponto e vírgula como separador, com acentuação preservada.</p>
      </div>
    `;

    mount.querySelector("#rep-print").addEventListener("click", () => window.print());
    mount.querySelector("#rep-xlsx").addEventListener("click", () => {
      try {
        FM.exports.download(`meu-lar-financeiro-relatorio-${month}.xlsx`, FM.exports.monthly(month));
        FM.ui.toast("Relatório mensal exportado em Excel.");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível gerar a planilha.", "error");
      }
    });

    mount.querySelectorAll("[data-report]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.report;
        let filename = `meu-lar-financeiro-${kind}-${month}.csv`;
        let headers = ["Indicador", "Valor"];
        let rows = [];
        if (kind === "resumo") {
          rows = [
            ["Mês", monthLabel(month, "long")],
            ["Organização", st().meta.name || "Meu Lar Financeiro"],
            ["Receitas recebidas", money(s.receitasRecebidas)],
            ["Despesas pagas", money(s.despesasPagas)],
            ["Resultado", money(s.resultado)],
            ["Saldo disponível", money(calc.consolidatedBalance(U.monthEnd(month)))],
            ["A pagar em aberto", money(pay.total)],
            ["A receber em aberto", money(rec.total)],
            ["A pagar vencido", money(pay.overdue.total)],
            ["A receber vencido", money(rec.overdue.total)],
            ["Orçamento planejado", money(budgets.planned)],
            ["Orçamento realizado", money(budgets.actual)],
          ];
        } else if (kind === "lancamentos") {
          headers = ["ID", "Data", "Tipo", "Descrição", "Origem", "Categoria", "Conta", "Centro", "Vencimento", "Status", "Valor", "Em aberto"];
          rows = st().transactions.filter((t) => monthKeyOf(t.date) === month).map((t) => [t.id, fmtDate(t.date), t.type === "receita" ? "Receita" : "Despesa", t.description, t.section || "Sem origem", `${t.category} › ${t.subcategory}`, calc.accountName(t.account), t.costCenter, fmtDate(t.dueDate), calc.effectiveStatus(t), money(t.amount), money(calc.remaining(t))]);
        } else if (kind === "abertos") {
          headers = ["Tipo", "Vencimento", "Descrição", "Categoria", "Conta", "Valor", "Em aberto", "Status"];
          rows = st().transactions.filter((t) => calc.isOpen(t)).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((t) => [t.type === "receita" ? "A receber" : "A pagar", fmtDate(t.dueDate), t.description, `${t.category} › ${t.subcategory}`, calc.accountName(t.account), money(t.amount), money(calc.remaining(t)), calc.effectiveStatus(t)]);
        } else if (kind === "categorias") {
          headers = ["Tipo", "Categoria", "Valor realizado", "Lançamentos"];
          rows = income.map((c) => ["Receita", c.name, money(c.total), c.count]).concat(spend.map((c) => ["Despesa", c.name, money(c.total), c.count]));
          filename = `meu-lar-financeiro-categorias-${month}.csv`;
        } else if (kind === "orcamento") {
          headers = ["Categoria", "Centro de custo", "Planejado", "Realizado", "Disponível", "Uso %"];
          rows = budgets.rows.map((r) => [r.category, r.costCenter || "Todos", money(r.planned), money(r.actual), money(r.remaining), pct(r.usage)]);
        } else if (kind === "fluxo") {
          headers = ["Mês", "Receitas recebidas", "Despesas pagas", "Resultado", "A receber", "A pagar", "Saldo projetado"];
          rows = calc.monthlySeries(lastMonthKeys(12, addMonthsKey(month, 6))).map((x) => [monthLabel(x.key, "long"), money(x.receitasRecebidas), money(x.despesasPagas), money(x.resultado), money(x.entradasPrevistas), money(x.saidasPrevistas), money(x.saldoProjetado)]);
        } else if (kind === "contas") {
          headers = ["Conta", "Instituição", "Tipo", "Saldo inicial", "Saldo atual", "Situação"];
          rows = accounts.map((a) => [a.name, a.institution, a.type, money(a.openingBalance), money(calc.accountBalance(a.id)), a.active ? "Ativa" : "Inativa"]);
        } else if (kind === "dre") {
          headers = ["Linha", "Valor"];
          rows = [["Receitas recebidas", money(s.receitasRecebidas)], ...income.map((c) => [`  ${c.name}`, money(c.total)]), ["Despesas pagas", money(s.despesasPagas)], ...spend.map((c) => [`  ${c.name}`, money(c.total)]), ["Resultado", money(s.resultado)], ["Margem", pct(s.receitasRecebidas ? s.resultado / s.receitasRecebidas : 0)]];
        }
        U.downloadCSV(filename, headers, rows);
        FM.ui.toast("Relatório exportado em CSV.");
      });
    });
  };

  /* =========================================================
     GUIA & DICAS
     ========================================================= */
  FM.views.guia = function (ctx, mount) {
    const org = st().meta.name || "Meu Lar Financeiro";
    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Guia de uso e dicas</h2><p>Regras do sistema, rotinas de controle e roteiro de evolução para ${esc(org)}.</p></div>
          <div class="content-actions"><button class="btn ghost sm" id="guide-print">${icon("printer")}Imprimir guia</button></div>
        </div>
        <div class="print-head"><strong>Guia de uso — Meu Lar Financeiro</strong><span>${esc(org)} · ${fmtDate(todayISO())}</span></div>

        <div class="guide-grid">
          <section class="card guide-card">
            <h3>${icon("sparkles")}Como o sistema pensa</h3>
            <p>O Meu Lar Financeiro usa uma <b>base central de lançamentos</b>. Contas a pagar/receber, DRE, fluxo e relatórios são visões derivadas — nunca digite o mesmo fato em dois lugares.</p>
            <ul>
              <li><b>Status automático</b>: sem baixa e vencimento futuro = Previsto; sem baixa e vencido = Atrasado; com baixa parcial = Parcial; quitado = Pago/Recebido; cancelado preserva histórico.</li>
              <li><b>Baixa</b> é o momento em que o dinheiro se move. Só a baixa altera saldo e resultado realizado.</li>
              <li><b>Transferências</b> movem valores entre contas e não entram como receita ou despesa. Taxas geram despesa financeira.</li>
              <li><b>Cancelar</b> nunca apaga: o título fica com motivo, data e trilha de auditoria.</li>
            </ul>
            <div class="tip-note">Regra de ouro: data do lançamento = competência; vencimento = prazo; baixa = caixa. Manter as três corretas evita distorções em todos os relatórios.</div>
          </section>

          <section class="card guide-card">
            <h3>${icon("file")}Como a planilha foi importada</h3>
            <p>Os dados válidos de <b>outubro, novembro e dezembro de 2026</b> vieram de “Contas 2026 Envios Extra.xlsx”.</p>
            <ul>
              <li><b>Contas fixas</b> ficaram em aberto porque a coluna “Pago?” estava desmarcada.</li>
              <li><b>Gastos do mês e cartão</b> foram registrados como pagos; quando o dia não existia, o primeiro dia do mês foi usado como referência.</li>
              <li>Categorias ausentes receberam <b>sugestões automáticas</b>. O aluguel continuou como Saúde porque era essa a classificação da planilha.</li>
              <li>Valores sem descrição, vencimento ou categoria não foram inventados; use “Não classificado” para revisar.</li>
              <li>Cartões e investimentos ficam separados do <b>saldo disponível</b>.</li>
            </ul>
          </section>

          <section class="card guide-card">
            <h3>${icon("check-circle")}Primeiros passos</h3>
            <div class="steps">
              <div class="step">Cadastre as contas em <b>Contas e investimentos</b> com o saldo inicial de cada uma.</div>
              <div class="step">Revise <b>Categorias</b> e <b>Centros de custo</b> para refletir sua realidade.</div>
              <div class="step">Defina o <b>orçamento</b> do mês por categoria e centro.</div>
              <div class="step">Registre receitas e despesas com data, vencimento e classificação.</div>
              <div class="step">Dê baixa somente quando o dinheiro efetivamente entrar ou sair.</div>
              <div class="step">Use <b>transferências</b> para movimentação entre contas.</div>
              <div class="step">Concilie o extrato bancário todo mês.</div>
              <div class="step">Acompanhe Dashboard, Fluxo de caixa e DRE.</div>
              <div class="step">Feche o mês: conciliação, DRE, orçamento realizado.</div>
              <div class="step">Baixe o backup em JSON em <b>Configurações</b>.</div>
            </div>
          </section>

          <section class="card guide-card">
            <h3>${icon("calendar")}Rotina de controle</h3>
            <p><b>Semanal</b></p>
            <ul>
              <li>Confira vencimentos dos próximos ${C().notificationSettings().dueDays} dias em Contas a pagar.</li>
              <li>Registre baixas pendentes e cobranças em atraso.</li>
              <li>Olhe o saldo projetado no Fluxo de caixa antes de assumir novos gastos.</li>
            </ul>
            <p style="margin-top:10px"><b>Mensal</b></p>
            <ul>
              <li>Concilie o extrato e resolva divergências.</li>
              <li>Feche o DRE e compare o orçamento com o realizado.</li>
              <li>Revise categorias com gasto fora do padrão.</li>
              <li>Atualize a projeção do próximo mês com receitas contratadas.</li>
            </ul>
            <p style="margin-top:10px"><b>Trimestral / anual</b></p>
            <ul>
              <li>Reavalie orçamento-base, contratos e fornecedores.</li>
              <li>Verifique a reserva (meta de 3 a 6 meses de despesas).</li>
              <li>Planeje investimentos apenas com caixa livre consistente.</li>
            </ul>
          </section>

          <section class="card guide-card">
            <h3>${icon("shield")}Boas práticas de controle</h3>
            <ul>
              <li><b>Separe funções</b>: quem lança não deve ser quem confere o extrato.</li>
              <li><b>Comprovantes</b>: registre número de recibo, nota ou boleto no campo de observação.</li>
              <li><b>Consistência</b>: use sempre a mesma categoria para o mesmo tipo de gasto.</li>
              <li><b>Provisão</b>: cadastre despesas futuras conhecidas (aluguel, salários, impostos) com vencimento real.</li>
              <li><b>Reserva intocável</b>: a conta Reserva só recebe transferências de excedente.</li>
              <li><b>Backup</b>: exporte o JSON após fechamentos e guarde fora do navegador.</li>
              <li><b>Antifraude</b>: estranhe pagamentos sem lastro, tarifas repetidas e fornecedores sem cadastro.</li>
            </ul>
            <div class="tip-note">Nunca “ajuste” um saldo lançando receita ou despesa fictícia. Corrija a origem: baixa errada, transferência não registrada ou tarifa esquecida.</div>
          </section>

          <section class="card guide-card">
            <h3>${icon("download")}Relatórios e extratos</h3>
            <ul>
              <li><b>Relatório mensal e resumo anual</b>: imprima em PDF ou baixe em Excel e CSV.</li>
              <li><b>Lançamentos</b>: o Excel e o CSV respeitam os filtros aplicados na tela.</li>
              <li><b>Extrato por período</b>: escolha datas e conta para acompanhar saldo inicial, movimentações e saldo final.</li>
              <li><b>Backup JSON</b>: guarde uma cópia após os fechamentos importantes.</li>
            </ul>
            <div class="tip-note">O PDF é gerado pela impressão do navegador. Selecione “Salvar como PDF” e mantenha o fundo branco.</div>
          </section>

          <section class="card guide-card">
            <h3>${icon("shield")}Conta, sincronização e instalação</h3>
            <ul>
              <li>Com o backend configurado, o login protege os dados e sincroniza o workspace na sua conta.</li>
              <li>Na versão somente estática, os dados permanecem neste navegador e o backup JSON é essencial.</li>
              <li>O aplicativo pode ser instalado pelo navegador em computador ou celular.</li>
              <li>O modo offline carrega a interface já visitada; consultar ou alterar dados autenticados exige conexão.</li>
              <li>O tema claro é o padrão; o escuro é opcional e fica salvo na sua conta.</li>
            </ul>
          </section>

          <section class="card guide-card wide">
            <h3>${icon("flag")}Recursos e próximos passos</h3>
            <p><span class="phase-tag p1">Disponível</span> Contas, categorias, lançamentos, cartões, faturas, orçamento, DRE, fluxo, conciliação, metas, compras, recorrências, lembretes e auditoria.</p>
            <p><span class="phase-tag p2">Disponível</span> Relatórios em PDF, Excel e CSV, extrato personalizado, resumo anual, backup JSON e instalação como aplicativo.</p>
            <p><span class="phase-tag p2">Disponível</span> Comprovantes em PDF, JPEG, PNG ou WebP (até 5 MiB) vinculados a lançamentos, contas, compras e faturas, com acesso privado.</p>
            <p><span class="phase-tag p3">Em evolução</span> Importação de extrato OFX/CSV e permissões para mais de uma pessoa.</p>
            <div class="tip-note">Próximo passo recomendado: manter os comprovantes anexados e a conciliação mensal em dia.</div>
          </section>

          <section class="card guide-card">
            <h3>${icon("trending-up")}Dicas de controle futuro</h3>
            <ul>
              <li><b>Recorrência</b>: automatize aluguel, salários e assinaturas — reduz esquecimento.</li>
              <li><b>Alertas</b>: vencimentos em ${C().notificationSettings().dueDays} dias, orçamento em ${C().notificationSettings().budgetWarning}% e metas sem movimento há ${C().notificationSettings().goalInactivityDays} dias.</li>
              <li><b>Metas</b>: acompanhe reserva mínima e resultado acumulado do ano.</li>
              <li><b>Sazonalidade</b>: compare o mesmo mês de anos anteriores para prever picos.</li>
              <li><b>Metas por centro</b>: responsabilize áreas pelo consumo do orçamento.</li>
              <li><b>Cenários</b>: simule queda de receita de 10–20% e veja o caixa suportar.</li>
            </ul>
          </section>

          <section class="card guide-card">
            <h3>${icon("info")}Limitações e cuidados</h3>
            <ul>
              <li>A sincronização e os comprovantes requerem o backend; o GitHub Pages sozinho funciona em modo local.</li>
              <li>Cada workspace pertence a uma conta; ainda não há permissões para múltiplas pessoas.</li>
              <li>Na versão somente estática, limpar os dados do navegador apaga tudo sem backup — exporte o JSON com frequência.</li>
              <li>O modo offline não baixa novos dados nem envia alterações; aguarde a conexão antes de continuar.</li>
              <li>Relatórios são gerenciais e não substituem contabilidade formal.</li>
            </ul>
            <div class="row mt-12" style="gap:8px;flex-wrap:wrap">
              <button class="btn sm subtle" id="guide-backup">${icon("download")}Baixar backup agora</button>
              <a class="btn sm ghost" href="#/configuracoes">${icon("settings")}Configurações</a>
            </div>
          </section>
        </div>
      </div>
    `;
    mount.querySelector("#guide-print").addEventListener("click", () => window.print());
    mount.querySelector("#guide-backup").addEventListener("click", async () => {
      try {
        await FM.store.exportJSON();
        FM.ui.toast("Backup JSON baixado.");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível baixar o backup.", "error");
      }
    });
  };

  /* =========================================================
     CONFIGURAÇÕES
     ========================================================= */
  FM.views.configuracoes = function (ctx, mount) {
    const meta = st().meta;
    const settings = st().settings;
    const notifications = FM.calc.notificationSettings();
    const sizeKb = (JSON.stringify(st()).length / 1024).toFixed(1);
    const storageScope = FM.store.remote ? "na sua conta" : "neste navegador";
    const accountEmail = FM.api.user?.email || meta.email || "";

    function listChips(kind) {
      return (st().settings[kind] || []).map((v) => `<span class="chip">${esc(v)}<button type="button" data-remove-list="${kind}|${esc(v)}" aria-label="Remover ${esc(v)}">${icon("x")}</button></span>`).join("");
    }

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Configurações</h2><p>Identidade, listas auxiliares, backup e segurança dos dados ${storageScope}.</p></div>
          <div class="content-actions"><span class="badge muted">${sizeKb} KB armazenados</span></div>
        </div>

        <div class="grid grid-2">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("user")}Perfil financeiro</div><div class="card-sub">Nome exibido no sistema e nos relatórios impressos</div></div></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="field full"><label for="org-input">Nome do perfil</label><input class="input" id="org-input" value="${esc(meta.name || "")}" maxlength="60" autocomplete="name"></div>
                ${accountEmail ? `<div class="field full"><label>E-mail da conta</label><input class="input" value="${esc(accountEmail)}" readonly></div>` : ""}
              </div>
              <div class="row mt-12" style="justify-content:flex-end"><button class="btn primary sm" id="save-org">${icon("save")}Salvar nome</button></div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("flower")}Aparência</div><div class="card-sub">O tema claro é o padrão; o escuro é opcional</div></div></div>
            <div class="card-body">
              <div class="segmented" id="theme-choice" aria-label="Tema do sistema">
                <button type="button" data-theme-choice="light" class="${settings.theme !== "dark" ? "active" : ""}" aria-pressed="${settings.theme !== "dark"}">${icon("sun")}Claro</button>
                <button type="button" data-theme-choice="dark" class="${settings.theme === "dark" ? "active" : ""}" aria-pressed="${settings.theme === "dark"}">${icon("moon")}Escuro</button>
              </div>
              <p class="small muted mt-12">A arte e as cores acompanham o tema escolhido. Sua preferência fica salva ${storageScope}.</p>
              <div class="chip-list mt-12">
                ${settings.types.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
                ${settings.statuses.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}
              </div>
            </div>
          </section>
        </div>

        <div class="grid grid-2 mt-16">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("credit-card")}Formas de pagamento</div><div class="card-sub">Usadas no cadastro de lançamentos</div></div></div>
            <div class="card-body">
              <div class="chip-list" id="methods-chips">${listChips("methods")}</div>
              <form class="row mt-12" id="methods-form" style="gap:8px">
                <input class="input" name="value" placeholder="Nova forma de pagamento" maxlength="30">
                <button class="btn sm subtle" type="submit">${icon("plus")}Adicionar</button>
              </form>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("repeat")}Periodicidades</div><div class="card-sub">Rótulos auxiliares para recorrências</div></div></div>
            <div class="card-body">
              <div class="chip-list" id="periodicities-chips">${listChips("periodicities")}</div>
              <form class="row mt-12" id="periodicities-form" style="gap:8px">
                <input class="input" name="value" placeholder="Nova periodicidade" maxlength="30">
                <button class="btn sm subtle" type="submit">${icon("plus")}Adicionar</button>
              </form>
            </div>
          </section>
        </div>

        <section class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("bell")}Alertas e notificações</div><div class="card-sub">Defina quando o sistema deve chamar sua atenção</div></div></div>
          <div class="card-body">
            <form id="notifications-form">
              <div class="form-grid">
                <div class="field"><label for="due-days">Avisar vencimentos com</label><div class="money-wrap"><input class="input" id="due-days" name="dueDays" type="number" min="1" max="60" step="1" value="${notifications.dueDays}" required><span>dias</span></div></div>
                <div class="field"><label for="goal-inactivity">Avisar meta sem movimento há</label><div class="money-wrap"><input class="input" id="goal-inactivity" name="goalInactivityDays" type="number" min="1" max="365" step="1" value="${notifications.goalInactivityDays}" required><span>dias</span></div></div>
                <div class="field"><label for="budget-warning">Aviso de orçamento</label><div class="money-wrap"><input class="input" id="budget-warning" name="budgetWarning" type="number" min="50" max="99" step="1" value="${notifications.budgetWarning}" required><span>%</span></div></div>
                <div class="field"><label for="budget-critical">Orçamento crítico</label><div class="money-wrap"><input class="input" id="budget-critical" name="budgetCritical" type="number" min="100" max="200" step="1" value="${notifications.budgetCritical}" required><span>%</span></div></div>
              </div>
              <div class="row mt-12" style="justify-content:flex-end"><button class="btn primary sm" type="submit">${icon("save")}Salvar notificações</button></div>
            </form>
          </div>
        </section>

        <section class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("save")}Backup e restauração</div><div class="card-sub">${FM.store.remote ? "Seus dados estão salvos na conta — mantenha também um backup" : "Seus dados vivem neste navegador — exporte com frequência"}</div></div></div>
          <div class="card-body">
            <div class="grid grid-3">
              <div class="budget-card">
                <div class="budget-card-head"><div><h4>Exportar backup</h4><span>Arquivo JSON completo</span></div>${icon("download")}</div>
                <p class="small muted">Inclui contas, lançamentos, baixas, orçamentos, conciliações e auditoria.</p>
                <button class="btn sm subtle" id="backup-export">${icon("download")}Baixar JSON</button>
              </div>
              <div class="budget-card">
                <div class="budget-card-head"><div><h4>Importar backup</h4><span>Substitui os dados atuais</span></div>${icon("upload")}</div>
                <p class="small muted">Use o mesmo arquivo exportado neste ou em outro navegador.</p>
                <button class="btn sm subtle" id="backup-import">${icon("upload")}Selecionar arquivo</button>
                <input type="file" id="import-file" accept=".json,application/json" hidden>
              </div>
              <div class="budget-card">
                <div class="budget-card-head"><div><h4>Dados da planilha</h4><span>Restaurar outubro a dezembro de 2026</span></div>${icon("refresh")}</div>
                <p class="small muted">Substitui todo o conteúdo pelos registros válidos de “Contas 2026 Envios Extra.xlsx”.</p>
                <button class="btn sm subtle" id="restore-demo">${icon("refresh")}Restaurar dados da planilha</button>
              </div>
            </div>
            <div class="analytics-callout mt-12">${icon("info")}<span>Importar backup <b>substitui</b> todos os dados atuais. Exporte antes de restaurar ou importar outro arquivo.</span></div>
          </div>
        </section>

        <section class="card mt-16">
          <div class="card-head">
            <div><div class="card-title">${icon("clock")}Auditoria recente</div><div class="card-sub">Últimos eventos registrados pelo sistema</div></div>
          </div>
          <div class="card-body flush">
            <div class="table-wrap">
              <table class="data compact">
                <thead><tr><th>Quando</th><th>Evento</th><th>Entidade</th><th>Referência</th><th>Detalhe</th></tr></thead>
                <tbody>${st().audit.length ? st().audit.slice(0, 20).map((a) => `<tr><td class="nowrap small muted">${fmtDateTime(a.ts)}</td><td><b>${esc(a.action)}</b></td><td class="small">${esc(a.entity)}</td><td class="mono small">${esc(a.ref)}</td><td class="small muted">${esc(a.detail)}</td></tr>`).join("") : `<tr><td colspan="5" class="small muted">Nenhum evento registrado.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </section>

        ${FM.store.remote ? `<section class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("shield")}Segurança da conta</div><div class="card-sub">Altere a senha sem repetir a confirmação</div></div></div>
          <div class="card-body">
            <form id="password-form">
              <div class="form-grid">
                <div class="field"><label for="current-password">Senha atual</label><input class="input" id="current-password" name="currentPassword" type="password" minlength="10" maxlength="128" autocomplete="current-password" required></div>
                <div class="field"><label for="new-password">Nova senha</label><input class="input" id="new-password" name="newPassword" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><span class="field-hint">Use de 10 a 128 caracteres, com letras e números.</span></div>
              </div>
              <div class="row mt-12" style="justify-content:flex-end"><button class="btn subtle sm" type="submit">${icon("save")}Salvar nova senha</button></div>
            </form>
          </div>
        </section>` : ""}

        <section class="card mt-16" style="border-color:rgba(204,88,114,.3)">
          <div class="card-head"><div><div class="card-title text-red">${icon("alert")}Zona de risco</div><div class="card-sub">Ações irreversíveis ${storageScope}</div></div></div>
          <div class="card-body">
            <div class="row between wrap">
              <p class="small muted" style="max-width:520px">Apagar todos os dados remove contas, lançamentos, baixas, orçamentos e conciliações. O sistema volta vazio. Exporte um backup antes.</p>
              <button class="btn sm danger" id="clear-all">${icon("trash")}Apagar todos os dados</button>
            </div>
            ${FM.store.remote ? `<div class="row between wrap mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
              <p class="small muted" style="max-width:520px">Excluir a conta remove permanentemente o cadastro, os dados salvos e todas as sessões. Baixe um backup antes.</p>
              <button class="btn sm danger" id="delete-account">${icon("trash")}Excluir minha conta</button>
            </div>` : ""}
          </div>
        </section>
      </div>
    `;

    mount.querySelector("#save-org").addEventListener("click", async () => {
      const button = mount.querySelector("#save-org");
      const val = mount.querySelector("#org-input").value;
      button.disabled = true;
      try {
        await FM.actions.updateProfile(val);
        FM.ui.toast("Nome do perfil atualizado.");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível salvar o nome do perfil.", "error");
      } finally {
        button.disabled = false;
      }
    });

    mount.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await FM.actions.setTheme(button.dataset.themeChoice);
          FM.ui.toast(button.dataset.themeChoice === "dark" ? "Tema escuro ativado." : "Tema claro ativado.", "success");
        } catch (error) {
          FM.ui.toast(error.message || "Não foi possível salvar o tema.", "error");
        } finally {
          button.disabled = false;
        }
      });
    });

    mount.querySelector("#notifications-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await FM.actions.updateNotifications(Object.fromEntries(new FormData(event.currentTarget).entries()));
        FM.ui.toast("Notificações salvas.", "success");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível salvar as notificações.", "error");
      } finally {
        button.disabled = false;
      }
    });

    const passwordForm = mount.querySelector("#password-form");
    if (passwordForm) passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form).entries());
      button.disabled = true;
      try {
        await FM.actions.changePassword(data.currentPassword, data.newPassword);
        form.reset();
        FM.ui.toast("Senha alterada. As outras sessões foram encerradas.", "success");
      } catch (error) {
        if (error.code === "REAUTH_REQUIRED") {
          await FM.api.logout().catch(() => {});
          window.dispatchEvent(new CustomEvent("meular:unauthorized"));
          return;
        }
        FM.ui.toast(error.message || "Não foi possível alterar a senha.", "error");
      } finally {
        button.disabled = false;
      }
    });

    const deleteButton = mount.querySelector("#delete-account");
    if (deleteButton) deleteButton.addEventListener("click", async () => {
      const ok = await FM.ui.confirm({
        title: "Excluir conta",
        message: `A conta ${accountEmail} e todos os dados salvos serão excluídos permanentemente. Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir conta",
        danger: true,
      });
      if (!ok) return;
      deleteButton.disabled = true;
      try {
        await FM.actions.deleteAccount();
        ["meu_lar_financeiro.v3", "livis_finance.v2", "meu_lar_financeiro.ui.v3", "livis_finance.ui.v2"].forEach((key) => {
          try { localStorage.removeItem(key); } catch (error) {}
        });
        FM.api.user = null;
        FM.api.csrfToken = "";
        FM.store.remote = false;
        FM.store.allowLocalMigration = false;
        FM.store.state = null;
        FM.theme.apply("light");
        FM.auth.show(FM.app.authenticated);
        FM.ui.toast("Conta excluída permanentemente.", "info");
      } catch (error) {
        if (error.code === "REAUTH_REQUIRED") {
          await FM.api.logout().catch(() => {});
          window.dispatchEvent(new CustomEvent("meular:unauthorized"));
          return;
        }
        FM.ui.toast(error.message || "Não foi possível excluir a conta.", "error");
      } finally {
        deleteButton.disabled = false;
      }
    });

    ["methods", "periodicities"].forEach((kind) => {
      const form = mount.querySelector(`#${kind}-form`);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector('input[name="value"]');
        const val = input.value.trim();
        if (!val) return;
        const list = (st().settings[kind] || []).slice();
        if (list.some((x) => x.toLowerCase() === val.toLowerCase())) {
          FM.ui.toast("Este item já existe na lista.", "warn");
          return;
        }
        list.push(val);
        FM.actions.updateLists(kind, list);
        input.value = "";
        FM.ui.toast("Item adicionado à lista.");
      });
    });
    mount.querySelectorAll("[data-remove-list]").forEach((b) => {
      b.addEventListener("click", () => {
        const [kind, val] = b.dataset.removeList.split("|");
        const list = (st().settings[kind] || []).filter((x) => x !== val);
        if (list.length < 1) {
          FM.ui.toast("Mantenha pelo menos um item na lista.", "warn");
          return;
        }
        FM.actions.updateLists(kind, list);
        FM.ui.toast("Item removido.", "info");
      });
    });

    mount.querySelector("#backup-export").addEventListener("click", async () => {
      try {
        await FM.store.exportJSON();
        FM.ui.toast("Backup JSON baixado.");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível baixar o backup.", "error");
      }
    });
    const fileInput = mount.querySelector("#import-file");
    mount.querySelector("#backup-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const ok = await FM.ui.confirm({
          title: "Importar backup",
          message: "Todos os dados atuais serão substituídos pelo conteúdo do arquivo. Exporte um backup antes de continuar.",
          confirmLabel: "Importar",
          danger: true,
        });
        if (!ok) return;
        try {
          await FM.store.importJSON(String(reader.result));
          FM.ui.toast("Backup restaurado com sucesso.");
        } catch (err) {
          FM.ui.toast(err.message || "Não foi possível restaurar o backup.", "error");
        }
      };
      reader.onerror = () => FM.ui.toast("Não foi possível ler o arquivo.", "error");
      reader.readAsText(file);
    });

    mount.querySelector("#restore-demo").addEventListener("click", async () => {
      const ok = await FM.ui.confirm({
        title: "Restaurar dados da planilha",
        message: "Todos os dados atuais serão substituídos pelos registros de outubro a dezembro de 2026. Deseja continuar?",
        confirmLabel: "Restaurar",
        danger: true,
      });
      if (!ok) return;
      try {
        await FM.store.restoreSheet();
        FM.ui.toast("Dados da planilha restaurados.", "info");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível restaurar os dados.", "error");
      }
    });

    mount.querySelector("#clear-all").addEventListener("click", async () => {
      const ok = await FM.ui.confirm({
        title: "Apagar todos os dados",
        message: `Contas, lançamentos, baixas, orçamentos e conciliações serão removidos definitivamente ${storageScope}. Não é possível desfazer. Exporte um backup antes.`,
        confirmLabel: "Apagar tudo",
        danger: true,
      });
      if (!ok) return;
      try {
        await FM.store.clearAll();
        FM.ui.toast("Todos os dados foram apagados.", "info");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível apagar os dados.", "error");
      }
    });
  };
})();

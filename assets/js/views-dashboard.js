/* =========================================================
   FINANCE MASTER — Dashboard
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const { esc, money, moneyShort, pct, monthLabel, addMonthsKey, todayISO, lastMonthKeys, fmtDate, dayDiff } = U;
  const icon = FM.ui.icon;
  const badge = FM.ui.statusBadge;

  function delta(cur, prev, goodWhenUp) {
    if (!prev) return `<span class="kpi-delta">sem base anterior</span>`;
    const d = (cur - prev) / Math.abs(prev);
    const up = d >= 0;
    const cls = up === goodWhenUp ? "up" : "down";
    return `<span class="kpi-delta ${cls}">${icon(up ? "trending-up" : "trending-down")}${up ? "+" : ""}${pct(d)}</span>`;
  }

  function groupCategories(list, max) {
    if (list.length <= max) return list;
    const top = list.slice(0, max - 1);
    const rest = list.slice(max - 1);
    const other = rest.reduce((s, c) => s + c.total, 0);
    return top.concat([{ name: "Outras categorias", total: other, count: rest.reduce((s, c) => s + c.count, 0) }]);
  }

  function dueLabel(iso) {
    const d = dayDiff(iso);
    if (d < 0) return `${Math.abs(d)}d em atraso`;
    if (d === 0) return "vence hoje";
    if (d === 1) return "vence amanhã";
    return `em ${d} dias`;
  }

  function insightCard(it) {
    const link = it.link ? `<a href="#/${it.link.route}" data-route-link>${esc(it.link.label)} ${icon("arrow-right")}</a>` : "";
    return `<div class="insight">
      <div class="insight-icon ${it.tone}">${icon(it.icon)}</div>
      <div class="insight-body"><strong>${esc(it.title)}</strong><p>${esc(it.text)}</p>${link}</div>
    </div>`;
  }

  FM.views.dashboard = function (ctx, mount) {
    const C = FM.calc;
    const st = FM.store.state;
    const month = ctx.month;
    const s = C.monthStats(month);
    const prev = C.monthStats(addMonthsKey(month, -1));
    const next = C.monthStats(addMonthsKey(month, 1));
    const cash = C.consolidatedBalance();
    const pay = C.openTotals("despesa");
    const rec = C.openTotals("receita");
    const keys = lastMonthKeys(6, month);
    const stats = C.monthlySeries(keys);
    const sparkSaldo = stats.map((x) => x.saldoFinal);
    const sparkRec = stats.map((x) => x.receitasRecebidas);
    const sparkDesp = stats.map((x) => x.despesasPagas);

    const cats = groupCategories(C.categorySpend(month, "despesa"), 5);
    const palette = FM.charts.palette;
    const donutItems = cats.map((c, i) => ({ label: c.name, value: c.total, color: palette[i % palette.length] }));

    const budgets = C.budgetRows(month);
    const budgetTotals = C.budgetTotals(month);
    const insights = C.insights(month);

    const openItems = st.transactions
      .filter((t) => C.isOpen(t) && t.dueDate)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
      .slice(0, 6);

    const recent = st.transactions
      .filter((t) => !C.isCancelled(t))
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 6);

    const overdueTotal = pay.overdue.total + rec.overdue.total;
    const overdueCount = pay.overdue.count + rec.overdue.count;

    const alertHtml = overdueCount
      ? `<div class="alert-strip danger">
          <div class="alert-icon">${icon("alert")}</div>
          <div class="alert-text"><strong>${overdueCount} título(s) vencido(s)</strong><span>${money(overdueTotal)} em atraso — ${pay.overdue.count} a pagar e ${rec.overdue.count} a receber. Regularize para manter o caixa saudável.</span></div>
          <a class="btn sm" href="#/${pay.overdue.count ? "a-pagar" : "a-receber"}">${icon("arrow-right")}Ver vencidos</a>
        </div>`
      : "";

    const budgetRowsHtml = budgets.length
      ? budgets.slice(0, 4).map((r) => {
          const cls = r.over ? "red" : r.usage >= 0.8 ? "amber" : "green";
          return `<div class="budget-item">
            <div class="budget-top">
              <div class="budget-name"><strong>${esc(r.category)}</strong><span>${esc(r.costCenter || "Todos os centros")}</span></div>
              <div class="budget-values"><strong class="${r.over ? "over" : ""}">${moneyShort(r.actual)}</strong> / ${moneyShort(r.planned)}</div>
            </div>
            <div class="progress ${cls}"><span style="width:${Math.min(r.usage * 100, 100).toFixed(1)}%"></span></div>
            <div class="budget-values" style="text-align:left"><span>${pct(r.usage)} utilizado${r.over ? " · orçamento estourado" : ` · restam ${moneyShort(r.remaining)}`}</span></div>
          </div>`;
        }).join("")
      : FM.ui.emptyState("target", "Nenhum orçamento neste mês", "Defina limites por categoria e centro de custo para comparar o planejado com o realizado.", `<a class="btn sm subtle" href="#/orcamento">Definir orçamento</a>`);

    const dueHtml = openItems.length
      ? `<div class="due-list">${openItems.map((t) => {
          const d = U.parseISO(t.dueDate);
          const late = t.dueDate < todayISO();
          const isReceita = t.type === "receita";
          return `<a class="due-item" href="#/${isReceita ? "a-receber" : "a-pagar"}">
            <div class="due-date ${late ? "late" : ""}"><b>${String(d.getDate()).padStart(2, "0")}</b><span>${U.MONTHS_SHORT[d.getMonth()]}</span></div>
            <div class="due-main"><strong>${esc(t.description)}</strong><span>${isReceita ? "A receber" : "A pagar"} · ${esc(t.category)} · ${dueLabel(t.dueDate)}</span></div>
            <div class="due-meta"><div class="amount ${isReceita ? "pos" : "neg"}">${money(C.remaining(t))}</div><small>${esc(C.accountName(t.account))}</small></div>
          </a>`;
        }).join("")}</div>`
      : `<div class="due-empty">${icon("check-circle")}<strong>Nada em aberto</strong><span>Todos os títulos estão quitados ou não há vencimentos futuros.</span></div>`;

    const insightsHtml = insights.slice(0, 4).map(insightCard).join("");

    const recentRows = recent.length
      ? recent.map((t) => {
          const status = C.effectiveStatus(t);
          return `<tr data-open-tx="${t.id}" class="clickable">
            <td><div class="cell-main">${FM.ui.typeMark(t.type)}<div class="cell-text"><div class="cell-title">${esc(t.description)}</div><div class="cell-sub">${esc(t.category)} › ${esc(t.subcategory)}</div></div></div></td>
            <td class="nowrap muted">${fmtDate(t.date, "short")}</td>
            <td>${badge(status)}</td>
            <td class="num"><span class="amount ${t.type === "receita" ? "pos" : "neg"}">${t.type === "receita" ? "+" : "−"} ${money(t.amount)}</span></td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="4">${FM.ui.emptyState("receipt", "Nenhum lançamento", "Registre a primeira operação para começar.", `<button class="btn sm subtle" data-new-tx>${icon("plus")}Novo lançamento</button>`)}</td></tr>`;

    const html = `
      <div class="page-enter">
        <div class="content-head">
          <div>
            <h2>Resumo financeiro</h2>
            <p>Competência de <b>${esc(monthLabel(month, "long"))}</b> · dados de demonstração · atualizado em ${fmtDate(todayISO(), "short")}</p>
          </div>
          <div class="content-actions">
            <button class="btn ghost sm" id="dash-export">${icon("download")}Exportar resumo</button>
            <a class="btn sm" href="#/relatorios">${icon("file")}Relatórios</a>
          </div>
        </div>

        ${alertHtml}

        <div class="kpi-grid">
          <article class="kpi hero">
            <div class="kpi-head"><span class="kpi-label">Saldo consolidado</span><span class="kpi-icon green">${icon("wallet")}</span></div>
            <div class="kpi-value ${cash < 0 ? "neg" : ""}">${money(cash)}</div>
            <div class="kpi-foot"><span>${st.accounts.length} conta(s) · inclui transferências</span></div>
            ${FM.charts.spark(sparkSaldo, "#2ed3a0")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Receitas recebidas</span><span class="kpi-icon green">${icon("arrow-up")}</span></div>
            <div class="kpi-value">${money(s.receitasRecebidas)}</div>
            <div class="kpi-foot">${delta(s.receitasRecebidas, prev.receitasRecebidas, true)}<span>vs. mês anterior</span></div>
            ${FM.charts.spark(sparkRec, "#2ed3a0")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Despesas pagas</span><span class="kpi-icon red">${icon("arrow-down")}</span></div>
            <div class="kpi-value">${money(s.despesasPagas)}</div>
            <div class="kpi-foot">${delta(s.despesasPagas, prev.despesasPagas, false)}<span>vs. mês anterior</span></div>
            ${FM.charts.spark(sparkDesp, "#ff6b81")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Resultado realizado</span><span class="kpi-icon ${s.resultado >= 0 ? "green" : "red"}">${icon(s.resultado >= 0 ? "trending-up" : "trending-down")}</span></div>
            <div class="kpi-value ${s.resultado >= 0 ? "pos" : "neg"}">${money(s.resultado)}</div>
            <div class="kpi-foot"><span>Margem de ${s.receitasRecebidas ? pct(s.resultado / s.receitasRecebidas) : "—"} · receitas − despesas pagas</span></div>
          </article>
        </div>

        <div class="grid grid-main">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("trending-up")}Evolução do saldo</div><div class="card-sub">Saldo consolidado ao final de cada mês</div></div>
              <a class="card-link" href="#/fluxo-caixa">Fluxo completo ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">
              ${FM.charts.area({ labels: stats.map((x) => x.label), series: [{ name: "Saldo final", values: sparkSaldo, color: "#2ed3a0" }], height: 236, zero: false, format: moneyShort })}
              ${FM.charts.legend([{ name: "Saldo final realizado", color: "#2ed3a0" }])}
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("pie")}Despesas por categoria</div><div class="card-sub">Valores efetivamente pagos</div></div>
              <a class="card-link" href="#/relatorios">Detalhar ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">
              ${donutItems.length ? FM.charts.donut({ items: donutItems, centerLabel: "Pago no mês", centerValue: moneyShort(s.despesasPagas) }) : FM.ui.emptyState("pie", "Sem despesas pagas", "As despesas aparecem aqui quando são baixadas no período.")}
            </div>
          </section>
        </div>

        <div class="grid grid-3 mt-16">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("clock")}Contas em aberto</div><div class="card-sub">Posição atual, independente do mês</div></div>
            </div>
            <div class="card-body">
              <div class="summary-row" style="padding:0 0 12px;border-bottom:0">
                <div class="mini-stat" style="flex:1"><span>A pagar</span><strong class="text-red">${money(pay.total)}</strong><small class="muted">${pay.count} título(s)</small></div>
                <div class="mini-stat" style="flex:1"><span>A receber</span><strong class="text-green">${money(rec.total)}</strong><small class="muted">${rec.count} título(s)</small></div>
              </div>
              <div class="row between small" style="padding-top:2px">
                <span class="muted">Vencidos: <b class="text-red">${money(pay.overdue.total + rec.overdue.total)}</b></span>
                <a class="card-link" href="#/a-pagar">Gerenciar ${icon("arrow-right")}</a>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("target")}Orçamento do mês</div><div class="card-sub">${pct(budgetTotals.usage)} consumido no total</div></div>
              <a class="card-link" href="#/orcamento">Ajustar ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">${budgetRowsHtml}</div>
          </section>

          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("flag")}Próximo mês</div><div class="card-sub">${esc(monthLabel(addMonthsKey(month, 1), "long"))}</div></div>
            </div>
            <div class="card-body">
              <div class="kpi-label">Saldo projetado</div>
              <div class="kpi-value ${next.saldoProjetado < 0 ? "neg" : ""}" style="margin-top:6px">${money(next.saldoProjetado)}</div>
              <div class="mt-12" style="display:grid;gap:6px">
                <div class="row between small"><span class="muted">Entradas previstas</span><b class="text-green">${money(next.entradasPrevistas)}</b></div>
                <div class="row between small"><span class="muted">Saídas previstas</span><b class="text-red">${money(next.saidasPrevistas)}</b></div>
                <div class="row between small"><span class="muted">Parcelas e títulos futuros</span><b>${next.countPagar + next.countReceber}</b></div>
              </div>
              <p class="small muted mt-12">Projeção soma títulos em aberto com vencimento no próximo mês, sem duplicar valores já realizados.</p>
            </div>
          </section>
        </div>

        <div class="grid grid-main mt-16">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("sparkles")}Alertas e dicas inteligentes</div><div class="card-sub">Leitura automática dos seus números no período</div></div>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px" class="insights-grid">${insightsHtml}</div>
            </div>
          </section>
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("calendar")}Próximos vencimentos</div><div class="card-sub">Em aberto, ordenados por data</div></div>
            </div>
            <div class="card-body">${dueHtml}</div>
          </section>
        </div>

        <div class="grid grid-main-rev mt-16">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("scale")}Receitas x despesas</div><div class="card-sub">Realizado nos últimos meses</div></div>
            </div>
            <div class="card-body">
              ${FM.charts.bars({
                labels: stats.map((x) => x.label),
                series: [
                  { name: "Receitas", values: stats.map((x) => x.receitasRecebidas), color: "#2ed3a0" },
                  { name: "Despesas", values: stats.map((x) => x.despesasPagas), color: "#ff6b81" },
                ],
                height: 220,
              })}
              ${FM.charts.legend([{ name: "Receitas recebidas", color: "#2ed3a0" }, { name: "Despesas pagas", color: "#ff6b81" }])}
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("receipt")}Últimos lançamentos</div><div class="card-sub">Clique para ver detalhes e baixas</div></div>
              <a class="card-link" href="#/lancamentos">Ver todos ${icon("arrow-right")}</a>
            </div>
            <div class="card-body flush">
              <div class="table-wrap"><table class="data compact"><thead><tr><th>Lançamento</th><th>Data</th><th>Status</th><th class="num">Valor</th></tr></thead><tbody>${recentRows}</tbody></table></div>
            </div>
          </section>
        </div>
      </div>
    `;

    mount.innerHTML = html;

    const grid = mount.querySelector(".insights-grid");
    if (grid && window.innerWidth < 700) grid.style.gridTemplateColumns = "1fr";

    mount.querySelector("#dash-export").addEventListener("click", () => {
      const rows = [
        ["Indicador", "Valor"],
        ["Mês de referência", monthLabel(month, "long")],
        ["Saldo consolidado", money(cash)],
        ["Receitas recebidas", money(s.receitasRecebidas)],
        ["Despesas pagas", money(s.despesasPagas)],
        ["Resultado realizado", money(s.resultado)],
        ["A pagar em aberto", money(pay.total)],
        ["A receber em aberto", money(rec.total)],
        ["Saldo projetado próximo mês", money(next.saldoProjetado)],
        [],
        ["Despesa por categoria", "Valor pago"],
        ...C.categorySpend(month, "despesa").map((c) => [c.name, money(c.total)]),
        [],
        ["Orçamento", "Planejado", "Realizado"],
        ...budgets.map((b) => [`${b.category} (${b.costCenter})`, money(b.planned), money(b.actual)]),
      ];
      U.downloadCSV(`luvis-finance-resumo-${month}.csv`, ["Resumo financeiro Luvis Finance"], rows);
      FM.ui.toast("Resumo exportado em CSV.", "success");
    });
  };
})();

/* =========================================================
   MEU LAR FINANCEIRO — Dashboard
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
    const plan = C.monthPlan(month);
    const prevPlan = C.monthPlan(addMonthsKey(month, -1));
    const cash = C.consolidatedBalance(U.monthEnd(month));
    const investments = C.investmentBalance(U.monthEnd(month));
    const goalsReserved = U.round2(st.goals.filter((goal) => goal.status !== "cancelled" && goal.startDate <= U.monthEnd(month)).reduce((total, goal) => total + U.num(goal.initialAmount) + (goal.movements || []).filter((movement) => movement.date <= U.monthEnd(month)).reduce((sum, movement) => sum + (movement.type === "retirada" ? -U.num(movement.amount) : U.num(movement.amount)), 0), 0));
    const cashCount = st.accounts.filter((a) => C.isCashAccount(a)).length;
    const pay = C.openTotals("despesa");
    const rec = C.openTotals("receita");
    const keys = lastMonthKeys(6, month);
    const stats = C.monthlySeries(keys);
    const sparkSaldo = stats.map((x) => x.saldoFinal);
    const sparkRec = stats.map((x) => x.receitasRecebidas);
    const sparkDesp = stats.map((x) => x.despesasPagas);

    const cats = groupCategories(C.categoryPlan(month, "despesa"), 5);
    const palette = FM.charts.palette;
    const donutItems = cats.map((c, i) => ({ label: c.name, value: c.total, color: palette[i % palette.length] }));
    const methods = C.paymentMethodTotals(month);
    const maxMethod = methods.reduce((max, m) => Math.max(max, m.total), 0);

    const budgets = C.budgetRows(month);
    const insights = C.insights(month);

    const openItems = st.transactions
      .filter((t) => C.isOpen(t))
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
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

    const methodRowsHtml = methods.length
      ? methods.map((m) => `<div class="budget-item">
          <div class="budget-top">
            <div class="budget-name"><strong>${esc(m.name)}</strong><span>${m.count} lançamento(s)</span></div>
            <div class="budget-values"><strong>${moneyShort(m.total)}</strong></div>
          </div>
          <div class="progress ${m.name.startsWith("Crédito") ? "purple" : "green"}"><span style="width:${maxMethod ? Math.min((m.total / maxMethod) * 100, 100).toFixed(1) : 0}%"></span></div>
        </div>`).join("")
      : FM.ui.emptyState("credit-card", "Nenhuma despesa neste mês", "As formas de pagamento aparecem quando há despesas registradas.");

    const dueHtml = openItems.length
      ? `<div class="due-list">${openItems.map((t) => {
          const d = t.dueDate ? U.parseISO(t.dueDate) : null;
          const late = !!t.dueDate && t.dueDate < todayISO();
          const isReceita = t.type === "receita";
          return `<a class="due-item" href="#/${isReceita ? "a-receber" : "a-pagar"}">
            <div class="due-date ${late ? "late" : ""}"><b>${d ? String(d.getDate()).padStart(2, "0") : "—"}</b><span>${d ? U.MONTHS_SHORT[d.getMonth()] : "sem data"}</span></div>
            <div class="due-main"><strong>${esc(t.description)}</strong><span>${isReceita ? "A receber" : "A pagar"} · ${esc(t.category)} · ${t.dueDate ? dueLabel(t.dueDate) : "vencimento não informado"}</span></div>
            <div class="due-meta"><div class="amount ${isReceita ? "pos" : "neg"}">${money(C.remaining(t))}</div><small>${esc(C.accountName(t.account))}</small></div>
          </a>`;
        }).join("")}</div>`
      : `<div class="due-empty">${icon("check-circle")}<strong>Nada em aberto</strong><span>Todos os títulos estão quitados ou não há vencimentos futuros.</span></div>`;

    const insightsHtml = insights.slice(0, 4).map(insightCard).join("");

    const recentRows = recent.length
      ? recent.map((t) => {
          const status = C.effectiveStatus(t);
          return `<tr data-open-tx="${t.id}" class="clickable">
            <td><div class="cell-main">${FM.ui.typeMark(t.type)}<div class="cell-text"><div class="cell-title">${esc(t.description)}</div><div class="cell-sub">${esc(t.section || "Sem origem")} · ${esc(t.category)}</div></div></div></td>
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
            <p>Competência de <b>${esc(monthLabel(month, "long"))}</b> · controle pessoal · atualizado em ${fmtDate(todayISO(), "short")}</p>
          </div>
          <div class="content-actions">
            <button class="btn ghost sm" id="dash-export">${icon("download")}Exportar resumo</button>
            <a class="btn sm" href="#/relatorios">${icon("file")}Relatórios</a>
          </div>
        </div>

        ${alertHtml}

        <div class="card mt-16">
          <div class="summary-row">
            <div class="mini-stat"><span>Contas fixas</span><strong class="text-red">${money(plan.fixas)}</strong><small class="muted">compromissos recorrentes</small></div>
            <div class="mini-stat"><span>Gastos do mês</span><strong class="text-red">${money(plan.variaveis)}</strong><small class="muted">compras e imprevistos</small></div>
            <div class="mini-stat"><span>Cartão de crédito</span><strong class="text-red">${money(plan.cartao)}</strong><small class="muted">compras nos cartões</small></div>
            <div class="mini-stat"><span>Reservas e investimentos</span><strong class="text-green">${money(investments)}</strong><small class="muted">${money(goalsReserved)} em metas · <a href="#/metas">ver metas</a></small></div>
          </div>
        </div>

        <div class="kpi-grid mt-16">
          <article class="kpi hero">
            <div class="kpi-head"><span class="kpi-label">Saldo disponível</span><span class="kpi-icon green">${icon("wallet")}</span></div>
            <div class="kpi-value ${cash < 0 ? "neg" : ""}">${money(cash)}</div>
            <div class="kpi-foot"><span>${cashCount} conta(s) · saldo em ${esc(monthLabel(month, "short"))} · cartões e investimentos à parte</span></div>
            ${FM.charts.spark(sparkSaldo, "#48ad8c")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Receitas do mês</span><span class="kpi-icon green">${icon("arrow-up")}</span></div>
            <div class="kpi-value">${money(plan.receitas)}</div>
            <div class="kpi-foot">${delta(plan.receitas, prevPlan.receitas, true)}<span>${money(s.receitasRecebidas)} recebidos</span></div>
            ${FM.charts.spark(sparkRec, "#48ad8c")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Despesas do mês</span><span class="kpi-icon red">${icon("arrow-down")}</span></div>
            <div class="kpi-value">${money(plan.despesas)}</div>
            <div class="kpi-foot">${delta(plan.despesas, prevPlan.despesas, false)}<span>${money(s.despesasPagas)} pagos</span></div>
            ${FM.charts.spark(sparkDesp, "#e27c94")}
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Resultado do mês</span><span class="kpi-icon ${plan.saldo >= 0 ? "green" : "red"}">${icon(plan.saldo >= 0 ? "trending-up" : "trending-down")}</span></div>
            <div class="kpi-value ${plan.saldo >= 0 ? "pos" : "neg"}">${money(plan.saldo)}</div>
            <div class="kpi-foot"><span>Receitas − despesas registradas · margem de ${plan.receitas ? pct(plan.saldo / plan.receitas) : "—"}</span></div>
          </article>
        </div>

        <div class="grid grid-main">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("trending-up")}Evolução do saldo</div><div class="card-sub">Saldo disponível ao final de cada mês</div></div>
              <a class="card-link" href="#/fluxo-caixa">Fluxo completo ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">
              ${FM.charts.area({ labels: stats.map((x) => x.label), series: [{ name: "Saldo final", values: sparkSaldo, color: "#48ad8c" }], height: 236, zero: false, format: moneyShort })}
              ${FM.charts.legend([{ name: "Saldo final realizado", color: "#48ad8c" }])}
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("pie")}Despesas por categoria</div><div class="card-sub">Todos os valores registrados no mês</div></div>
              <a class="card-link" href="#/relatorios">Detalhar ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">
              ${donutItems.length ? FM.charts.donut({ items: donutItems, centerLabel: "Registrado no mês", centerValue: moneyShort(plan.despesas) }) : FM.ui.emptyState("pie", "Sem despesas registradas", "As despesas aparecem aqui assim que forem lançadas no período.")}
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
              <div><div class="card-title">${icon("credit-card")}Formas de pagamento</div><div class="card-sub">Distribuição das despesas registradas</div></div>
              <a class="card-link" href="#/relatorios">Detalhar ${icon("arrow-right")}</a>
            </div>
            <div class="card-body">${methodRowsHtml}</div>
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
                  { name: "Receitas", values: stats.map((x) => x.receitasRecebidas), color: "#48ad8c" },
                  { name: "Despesas", values: stats.map((x) => x.despesasPagas), color: "#e27c94" },
                ],
                height: 220,
              })}
              ${FM.charts.legend([{ name: "Receitas recebidas", color: "#48ad8c" }, { name: "Despesas pagas", color: "#e27c94" }])}
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
        ["Saldo disponível", money(cash)],
        ["Receitas registradas", money(plan.receitas)],
        ["Receitas recebidas", money(s.receitasRecebidas)],
        ["Despesas registradas", money(plan.despesas)],
        ["Despesas pagas", money(s.despesasPagas)],
        ["Resultado do mês", money(plan.saldo)],
        ["Contas fixas", money(plan.fixas)],
        ["Gastos do mês", money(plan.variaveis)],
        ["Cartão de crédito", money(plan.cartao)],
        ["Investimentos acumulados", money(investments)],
        ["A pagar em aberto", money(pay.total)],
        ["A receber em aberto", money(rec.total)],
        ["Saldo projetado próximo mês", money(next.saldoProjetado)],
        [],
        ["Despesa por categoria", "Valor registrado"],
        ...C.categoryPlan(month, "despesa").map((c) => [c.name, money(c.total)]),
        [],
        ["Forma de pagamento", "Valor registrado"],
        ...methods.map((m) => [m.name, money(m.total)]),
        [],
        ["Orçamento", "Planejado", "Realizado"],
        ...budgets.map((b) => [`${b.category} (${b.costCenter})`, money(b.planned), money(b.actual)]),
      ];
      U.downloadCSV(`meu-lar-financeiro-resumo-${month}.csv`, ["Resumo financeiro Meu Lar Financeiro"], rows);
      FM.ui.toast("Resumo exportado em CSV.", "success");
    });
  };
})();

(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const C = () => FM.calc;
  const st = () => FM.store.state;
  const { STYLES, buildXlsx, columnName } = FMXlsx;

  function sheet(name, title, subtitle, headers, rows, columns = {}) {
    const max = Math.max(1, headers.length);
    const header = headers.map((label) => ({ value: label, style: STYLES.header }));
    const body = rows.map((row) => headers.map((_, index) => {
      const value = row[index];
      const config = columns[index] || {};
      if (value == null || value === "") return { value: "", style: config.style || 0 };
      if (config.style === STYLES.date) return { value, style: STYLES.date };
      if (config.style === STYLES.currency && typeof value === "string") {
        return { value: U.parseMoneyInput(value), style: STYLES.currency };
      }
      return { value, style: config.style || 0 };
    }));
    return {
      name,
      rows: [
        [{ value: title, style: STYLES.title }],
        [{ value: subtitle, style: STYLES.subtitle }],
        header,
        ...body,
      ],
      merges: [`A1:${columnName(max)}1`, `A2:${columnName(max)}2`],
      columnWidths: headers.map((_, index) => columns[index]?.width || 18),
      freezeRows: 3,
      autoFilter: `A3:${columnName(max)}${Math.max(3, rows.length + 3)}`,
    };
  }

  function download(filename, sheets) {
    const data = buildXlsx(sheets);
    FM.utils.downloadFile(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  }

  function transactionRows(transactions) {
    return transactions.map((tx) => [
      tx.date, tx.type === "receita" ? "Receita" : "Despesa", tx.description, tx.section || "Sem origem",
      tx.category, tx.subcategory, C().accountName(tx.account), tx.costCenter, tx.dueDate || "",
      tx.paidDate || "", C().effectiveStatus(tx), tx.method, U.num(tx.amount), C().remaining(tx), tx.note || "",
    ]);
  }

  function transactions(list) {
    return sheet("Lançamentos", "Lançamentos filtrados", `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      ["Data", "Tipo", "Descrição", "Origem", "Categoria", "Subcategoria", "Conta", "Centro", "Vencimento", "Baixa", "Status", "Forma", "Valor", "Em aberto", "Observação"],
      transactionRows(list),
      { 0: { style: STYLES.date }, 2: { width: 34, style: STYLES.wrapped }, 4: { width: 24 }, 6: { width: 24 }, 8: { style: STYLES.date }, 9: { style: STYLES.date }, 12: { style: STYLES.currency }, 13: { style: STYLES.currency }, 14: { width: 32, style: STYLES.wrapped } });
  }

  function monthly(month) {
    const calc = C();
    const stats = calc.monthStats(month);
    const plan = calc.monthPlan(month);
    const income = calc.categoryIncome(month);
    const spend = calc.categorySpend(month);
    const budget = calc.budgetTotals(month);
    const generated = new Date().toLocaleString("pt-BR");
    const period = U.monthLabel(month, "long");
    const tx = st().transactions.filter((item) => U.monthKeyOf(item.date) === month && !calc.isCancelled(item)).sort((a, b) => a.date.localeCompare(b.date));
    return [
      sheet("Resumo", "Relatório mensal", `${period} · gerado em ${generated}`, ["Indicador", "Valor"], [
        ["Receitas previstas", plan.receitas],
        ["Receitas recebidas", stats.receitasRecebidas],
        ["Despesas previstas", plan.despesas],
        ["Despesas pagas", stats.despesasPagas],
        ["Resultado realizado", stats.resultado],
        ["Saldo disponível no fim do mês", calc.consolidatedBalance(U.monthEnd(month))],
        ["A pagar em aberto", calc.openTotals("despesa").total],
        ["A receber em aberto", calc.openTotals("receita").total],
      ], { 0: { width: 36 }, 1: { style: STYLES.currency, width: 20 } }),
      sheet("DRE", "DRE gerencial", `${period} · regime de caixa · gerado em ${generated}`, ["Linha", "Valor"], [
        ...income.map((item) => [`Receita · ${item.name}`, item.total]),
        ["Total de receitas recebidas", stats.receitasRecebidas],
        ...spend.map((item) => [`Despesa · ${item.name}`, item.total]),
        ["Total de despesas pagas", stats.despesasPagas],
        ["Resultado", stats.resultado],
      ], { 0: { width: 40 }, 1: { style: STYLES.currency, width: 20 } }),
      sheet("Categorias", "Receitas e despesas por categoria", `${period} · valores recebidos e pagos`, ["Tipo", "Categoria", "Valor", "Lançamentos"], [
        ...income.map((item) => ["Receita", item.name, item.total, item.count]),
        ...spend.map((item) => ["Despesa", item.name, item.total, item.count]),
      ], { 0: { width: 14 }, 1: { width: 32 }, 2: { style: STYLES.currency }, 3: { style: STYLES.integer } }),
      sheet("Orçamento", "Planejado versus realizado", period, ["Categoria", "Centro de custo", "Planejado", "Realizado", "Disponível", "Uso"], budget.rows.map((row) => [
        row.category, row.costCenter || "Todos", row.planned, row.actual, row.remaining, row.usage,
      ]), { 0: { width: 28 }, 1: { width: 24 }, 2: { style: STYLES.currency }, 3: { style: STYLES.currency }, 4: { style: STYLES.currency }, 5: { style: STYLES.percent } }),
      transactions(tx),
      sheet("Contas", "Saldos por conta", `Posição em ${U.monthEnd(month)}`, ["Conta", "Instituição", "Tipo", "Saldo inicial", "Saldo final", "Situação"], st().accounts.map((account) => [
        account.name, account.institution, account.type, account.openingBalance, calc.accountBalance(account.id, U.monthEnd(month)), account.active ? "Ativa" : "Inativa",
      ]), { 0: { width: 28 }, 1: { width: 24 }, 3: { style: STYLES.currency }, 4: { style: STYLES.currency } }),
    ];
  }

  function annual(year, months) {
    const generated = new Date().toLocaleString("pt-BR");
    const donors = (st().donors || []).map((donor) => {
      const entries = st().transactions.filter((tx) => !C().isCancelled(tx) && tx.type === "receita" && tx.donorId === donor.id && U.monthKeyOf(tx.date).startsWith(`${year}-`));
      return [donor.name, donor.contact || "", entries.reduce((sum, tx) => sum + U.num(tx.amount), 0), entries.length, donor.active ? "Ativo" : "Inativo"];
    }).sort((a, b) => b[2] - a[2]);
    return [
      sheet("Resumo anual", `Resumo anual ${year}`, `Gerado em ${generated} · meses sem movimentação ficam vazios`,
        ["Mês", "Receitas", "Despesas", "Saldo", "Acumulado", "Crescimento", "Investimentos", "Ofertantes"], months.map((month) => [
          month.label, month.movimentado ? month.receitas : "", month.movimentado ? month.despesas : "", month.movimentado ? month.saldo : "",
          month.movimentado ? month.acumulado : "", month.crescimento == null ? "" : month.crescimento,
          month.movimentado ? month.investimentos : "", [...new Map(month.ofertantes.map((donor) => [donor.id, donor.name])).values()].join(", "),
        ]), { 0: { width: 20 }, 1: { style: STYLES.currency }, 2: { style: STYLES.currency }, 3: { style: STYLES.currency }, 4: { style: STYLES.currency }, 5: { style: STYLES.percent }, 6: { style: STYLES.currency }, 7: { width: 38, style: STYLES.wrapped } }),
      sheet("Ofertantes", `Ofertantes em ${year}`, "Receitas vinculadas aos cadastros", ["Nome", "Contato", "Receitas no ano", "Lançamentos", "Situação"], donors,
        { 0: { width: 30 }, 1: { width: 28 }, 2: { style: STYLES.currency }, 3: { style: STYLES.integer } }),
    ];
  }

  function statement(entries, summary) {
    const generated = new Date().toLocaleString("pt-BR");
    return sheet("Extrato", "Extrato por período", `${summary.account} · ${U.fmtDate(summary.start)} a ${U.fmtDate(summary.end)} · gerado em ${generated}`,
      ["Data", "Descrição", "Categoria", "Conta", "Entrada", "Saída", "Saldo após", "Referência"], entries.map((entry) => [
        entry.date, entry.description, entry.category, entry.account, entry.credit, entry.debit, entry.balance, entry.reference,
      ]), { 0: { style: STYLES.date }, 1: { width: 36, style: STYLES.wrapped }, 2: { width: 24 }, 3: { width: 24 }, 4: { style: STYLES.currency }, 5: { style: STYLES.currency }, 6: { style: STYLES.currency }, 7: { width: 22 } });
  }

  FM.exports = { download, transactions, monthly, annual, statement };
})();

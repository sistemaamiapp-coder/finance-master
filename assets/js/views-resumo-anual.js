(function () {
  "use strict";
  const FM = window.FM;
  const { esc, money, pct, monthKeyOf, todayISO } = FM.utils;
  const icon = FM.ui.icon;
  const st = () => FM.store.state;
  let annualYear = Number(todayISO().slice(0, 4));

  function donorForm(donor) {
    const editing = !!donor;
    FM.ui.modalForm({
      title: editing ? "Editar ofertante" : "Novo ofertante",
      subtitle: "Cadastro estável para vincular às receitas e identificar quem contribuiu no ano.",
      size: "sm",
      submitLabel: editing ? "Salvar ofertante" : "Criar ofertante",
      submitIcon: "user",
      body: `<div class="form-grid">
        <div class="field full"><label>Nome</label><input class="input" name="name" maxlength="120" value="${esc(donor?.name || "")}" required></div>
        <div class="field full"><label>Contato (opcional)</label><input class="input" name="contact" maxlength="120" value="${esc(donor?.contact || "")}" placeholder="Telefone ou e-mail"></div>
        <div class="field full"><label>Observação</label><textarea class="textarea" name="note" maxlength="300">${esc(donor?.note || "")}</textarea></div>
        <div class="field full"><label class="check"><input type="checkbox" name="active" ${!donor || donor.active !== false ? "checked" : ""}> Cadastro ativo</label></div>
      </div>`,
      async onSubmit(fd) {
        await FM.actions.saveDonor({ name: fd.get("name"), contact: fd.get("contact"), note: fd.get("note"), active: !!fd.get("active") }, donor?.id || null);
        FM.ui.toast(editing ? "Ofertante atualizado." : "Ofertante cadastrado.");
      },
    });
  }

  function donorTotals(year) {
    return (st().donors || []).map((donor) => {
      const entries = st().transactions.filter((tx) => !FM.calc.isCancelled(tx) && tx.type === "receita" && tx.donorId === donor.id && monthKeyOf(tx.date).startsWith(`${year}-`));
      return { donor, total: entries.reduce((sum, tx) => sum + FM.utils.num(tx.amount), 0), count: entries.length };
    }).sort((a, b) => b.total - a.total || a.donor.name.localeCompare(b.donor.name, "pt-BR"));
  }

  function valueOrDash(moved, value) {
    return moved ? money(value) : "—";
  }

  FM.views["resumo-anual"] = async function (ctx, mount) {
    const year = Number(ctx.year || annualYear);
    annualYear = year;
    mount.innerHTML = `<div class="page-enter"><div class="card"><div class="card-body">Carregando resumo anual...</div></div></div>`;
    let months;
    try {
      months = await FM.actions.getAnnualSummary(year);
    } catch (error) {
      mount.innerHTML = `<div class="card"><div class="card-body"><div class="card-title">${icon("alert")}Não foi possível carregar o resumo</div><p class="small muted mt-8">${esc(error.message)}</p></div></div>`;
      return;
    }
    const totals = months.reduce((sum, month) => ({
      receitas: sum.receitas + month.receitas,
      despesas: sum.despesas + month.despesas,
      recebido: sum.recebido + month.recebido,
      pago: sum.pago + month.pago,
      saldo: sum.saldo + month.saldo,
      investimentos: sum.investimentos + month.investimentos,
    }), { receitas: 0, despesas: 0, recebido: 0, pago: 0, saldo: 0, investimentos: 0 });
    const donors = donorTotals(year);
    const currentYear = Number(todayISO().slice(0, 4));
    const years = Array.from({ length: 9 }, (_, index) => currentYear - 5 + index);
    if (!years.includes(year)) years.push(year);
    years.sort((a, b) => b - a);

    mount.innerHTML = `<div class="page-enter annual-page">
      <div class="content-head"><div><h2>Resumo anual ${year}</h2><p>Receitas, despesas, resultado, investimentos e ofertantes mês a mês.</p></div>
        <div class="content-actions"><select class="select compact-select" id="annual-year" aria-label="Ano do relatório">${years.map((item) => `<option value="${item}" ${item === year ? "selected" : ""}>${item}</option>`).join("")}</select><button class="btn ghost sm" id="annual-print">${icon("printer")}Imprimir / PDF</button><button class="btn ghost sm" id="annual-xlsx">${icon("download")}Excel</button><button class="btn primary sm" id="annual-csv">${icon("download")}CSV</button></div></div>
      <div class="print-head"><strong>Resumo anual ${year}</strong><span>${esc(st().meta.name || "Meu Lar Financeiro")} · gerado em ${new Date().toLocaleString("pt-BR")}</span></div>
      <div class="kpi-grid">
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Receitas previstas</span><span class="kpi-icon green">${icon("arrow-up")}</span></div><div class="kpi-value">${money(totals.receitas)}</div><div class="kpi-foot"><span>Recebido no ano: ${money(totals.recebido)}</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Despesas previstas</span><span class="kpi-icon red">${icon("arrow-down")}</span></div><div class="kpi-value">${money(totals.despesas)}</div><div class="kpi-foot"><span>Pago no ano: ${money(totals.pago)}</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Resultado realizado</span><span class="kpi-icon cyan">${icon("scale")}</span></div><div class="kpi-value ${totals.saldo < 0 ? "text-red" : "text-green"}">${money(totals.saldo)}</div><div class="kpi-foot"><span>Recebido menos pago</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Investimentos</span><span class="kpi-icon violet">${icon("trending-up")}</span></div><div class="kpi-value">${money(totals.investimentos)}</div><div class="kpi-foot"><span>Transferências para investimento</span></div></article>
      </div>
      <div class="card mt-16 annual-card"><div class="card-head"><div><div class="card-title">${icon("file")}Visão anual</div><div class="card-sub">Meses sem movimentação aparecem com “—”, sem valores inventados.</div></div></div>
        <div class="annual-table-wrap"><table class="data annual-table">
          <thead><tr><th>Mês</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Saldo</th><th class="num">Saldo acumulado</th><th class="num">Crescimento</th><th class="num">Investimentos</th><th>Ofertantes</th></tr></thead>
          <tbody>${months.map((month) => `<tr class="${month.movimentado ? "" : "row-muted"}"><td><strong>${esc(month.label)}</strong></td><td class="num">${valueOrDash(month.movimentado, month.receitas)}</td><td class="num">${valueOrDash(month.movimentado, month.despesas)}</td><td class="num ${month.saldo < 0 ? "text-red" : "text-green"}">${valueOrDash(month.movimentado, month.saldo)}</td><td class="num">${valueOrDash(month.movimentado, month.acumulado)}</td><td class="num">${month.crescimento == null ? "—" : pct(month.crescimento, 1)}</td><td class="num">${valueOrDash(month.movimentado, month.investimentos)}</td><td class="annual-donors">${month.ofertantes.length ? [...new Map(month.ofertantes.map((donor) => [donor.id, donor.name])).values()].map(esc).join(", ") : "—"}</td></tr>`).join("")}</tbody>
          <tfoot><tr><th>Total ${year}</th><th class="num">${money(totals.receitas)}</th><th class="num">${money(totals.despesas)}</th><th class="num">${money(totals.saldo)}</th><th class="num">${money(months[11].acumulado)}</th><th class="num">—</th><th class="num">${money(totals.investimentos)}</th><th>${donors.length} cadastro(s)</th></tr></tfoot>
        </table></div>
      </div>
      <div class="card mt-16"><div class="card-head"><div><div class="card-title">${icon("user")}Ofertantes</div><div class="card-sub">Totais das receitas vinculadas em ${year}</div></div><button class="btn primary sm" id="new-donor">${icon("plus")}Novo ofertante</button></div>
        <div class="card-body">${donors.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Nome</th><th>Contato</th><th class="num">Receitas no ano</th><th class="num">Lançamentos</th><th>Situação</th><th class="actions">Ações</th></tr></thead><tbody>${donors.map(({ donor, total, count }) => `<tr><td><strong>${esc(donor.name)}</strong>${donor.note ? `<div class="small muted">${esc(donor.note)}</div>` : ""}</td><td>${esc(donor.contact || "—")}</td><td class="num amount">${money(total)}</td><td class="num">${count}</td><td><span class="badge ${donor.active ? "ok" : "muted"}">${donor.active ? "Ativo" : "Inativo"}</span></td><td class="actions"><button class="icon-btn sm" data-edit-donor="${esc(donor.id)}" title="Editar">${icon("edit")}</button><button class="icon-btn sm" data-toggle-donor="${esc(donor.id)}" title="${donor.active ? "Desativar" : "Reativar"}">${icon(donor.active ? "arrow-down" : "arrow-up")}</button><button class="icon-btn sm danger" data-delete-donor="${esc(donor.id)}" title="Excluir">${icon("trash")}</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="reminder-empty">${icon("user")}Nenhum ofertante cadastrado. Vincule o cadastro a uma receita para incluí-lo no relatório.</div>`}</div>
      </div>
      <p class="small muted mt-12">${icon("info")} Receitas e despesas previstas seguem a data do lançamento; saldo e acumulado usam pagamentos realizados. O crescimento compara as despesas previstas com o mês anterior.</p>
    </div>`;

    mount.querySelector("#annual-year").addEventListener("change", (event) => {
      annualYear = Number(event.target.value);
      FM.app.renderCurrent();
    });
    mount.querySelector("#annual-print").addEventListener("click", () => window.print());
    mount.querySelector("#annual-xlsx").addEventListener("click", () => {
      try {
        FM.exports.download(`resumo-anual-${year}.xlsx`, FM.exports.annual(year, months));
        FM.ui.toast("Resumo anual exportado em Excel.");
      } catch (error) {
        FM.ui.toast(error.message || "Não foi possível gerar a planilha.", "error");
      }
    });
    mount.querySelector("#annual-csv").addEventListener("click", () => {
      FM.utils.downloadCSV(`resumo-anual-${year}.csv`, ["Mês", "Receitas", "Despesas", "Saldo", "Saldo acumulado", "Crescimento", "Investimentos", "Ofertantes"], months.map((month) => [
        month.label, month.movimentado ? month.receitas.toFixed(2) : "", month.movimentado ? month.despesas.toFixed(2) : "",
        month.movimentado ? month.saldo.toFixed(2) : "", month.movimentado ? month.acumulado.toFixed(2) : "",
        month.crescimento == null ? "" : (month.crescimento * 100).toFixed(2), month.movimentado ? month.investimentos.toFixed(2) : "",
        [...new Map(month.ofertantes.map((donor) => [donor.id, donor.name])).values()].join(", "),
      ]));
      FM.ui.toast("Resumo anual exportado em CSV.");
    });
    mount.querySelector("#new-donor").addEventListener("click", () => donorForm(null));
    mount.querySelectorAll("[data-edit-donor]").forEach((button) => button.addEventListener("click", () => donorForm(st().donors.find((donor) => donor.id === button.dataset.editDonor))));
    mount.querySelectorAll("[data-toggle-donor]").forEach((button) => button.addEventListener("click", async () => {
      try { await FM.actions.toggleDonor(button.dataset.toggleDonor); }
      catch (error) { FM.ui.toast(error.message, "error"); }
    }));
    mount.querySelectorAll("[data-delete-donor]").forEach((button) => button.addEventListener("click", async () => {
      const donor = st().donors.find((item) => item.id === button.dataset.deleteDonor);
      const ok = await FM.ui.confirm({ title: "Excluir ofertante", message: `O cadastro de ${esc(donor.name)} será excluído. Receitas já vinculadas impedem a exclusão.`, confirmLabel: "Excluir", danger: true });
      if (!ok) return;
      try { await FM.actions.deleteDonor(donor.id); FM.ui.toast("Ofertante excluído.", "info"); }
      catch (error) { FM.ui.toast(error.message, "error"); }
    }));
  };
})();

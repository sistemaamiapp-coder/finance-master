(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const C = () => FM.calc;
  const st = () => FM.store.state;
  const { esc, money, fmtDate, monthStart, monthEnd, addDaysISO } = U;
  const icon = FM.ui.icon;

  FM.views.extrato = function (ctx, mount) {
    let start = monthStart(ctx.month);
    let end = monthEnd(ctx.month);
    let accountId = st().accounts.find((account) => C().isCashAccount(account))?.id || st().accounts[0]?.id || "";
    let current = { entries: [], opening: 0, closing: 0, credit: 0, debit: 0 };

    function calculate() {
      const calc = C();
      const ids = new Set(accountId ? [accountId] : st().accounts.map((account) => account.id));
      const entries = [];
      st().transactions.forEach((tx) => {
        if (calc.isCancelled(tx)) return;
        (tx.payments || []).forEach((payment, index) => {
          const id = payment.account || tx.account;
          if (!ids.has(id) || payment.date < start || payment.date > end) return;
          const credit = tx.type === "receita" ? U.num(payment.amount) : 0;
          entries.push({
            date: payment.date,
            description: `${tx.description} · ${index ? "baixa complementar" : "baixa"}`,
            category: `${tx.category} › ${tx.subcategory}`,
            account: calc.accountName(id),
            credit,
            debit: tx.type === "despesa" ? U.num(payment.amount) : 0,
            reference: `${tx.id} · ${payment.id || index + 1}`,
          });
        });
        if (calc.accountById(tx.account)?.type === "Cartão de crédito" && tx.section === "Cartão de crédito" && !(tx.payments || []).length && ids.has(tx.account) && tx.date >= start && tx.date <= end) {
          entries.push({
            date: tx.date,
            description: tx.description,
            category: `${tx.category} › ${tx.subcategory}`,
            account: calc.accountName(tx.account),
            credit: 0,
            debit: U.num(tx.amount),
            reference: tx.id,
          });
        }
      });
      st().transfers.forEach((transfer) => {
        if (transfer.date < start || transfer.date > end) return;
        if (ids.has(transfer.fromAccount)) entries.push({
          date: transfer.date, description: `Transferência para ${calc.accountName(transfer.toAccount)}`, category: "Transferência",
          account: calc.accountName(transfer.fromAccount), credit: 0, debit: U.num(transfer.amount), reference: transfer.id,
        });
        if (ids.has(transfer.toAccount)) entries.push({
          date: transfer.date, description: `Transferência de ${calc.accountName(transfer.fromAccount)}`, category: "Transferência",
          account: calc.accountName(transfer.toAccount), credit: U.num(transfer.amount), debit: 0, reference: transfer.id,
        });
      });
      entries.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));
      const opening = st().accounts.filter((account) => ids.has(account.id)).reduce((sum, account) => sum + calc.accountBalance(account.id, addDaysISO(start, -1)), 0);
      let balance = opening;
      let credit = 0;
      let debit = 0;
      entries.forEach((entry) => {
        balance = U.round2(balance + entry.credit - entry.debit);
        entry.balance = balance;
        credit = U.round2(credit + entry.credit);
        debit = U.round2(debit + entry.debit);
      });
      current = { entries, opening: U.round2(opening), closing: balance, credit, debit };
    }

    function renderRows() {
      calculate();
      const total = (value) => money(value);
      mount.querySelector("#statement-account-name").textContent = accountId ? C().accountName(accountId) : "Todas as contas";
      mount.querySelector("#statement-opening").textContent = total(current.opening);
      mount.querySelector("#statement-credit").textContent = total(current.credit);
      mount.querySelector("#statement-debit").textContent = total(current.debit);
      mount.querySelector("#statement-closing").textContent = total(current.closing);
      mount.querySelector("#statement-count").textContent = `${current.entries.length} movimento(s)`;
      mount.querySelector("#statement-body").innerHTML = current.entries.length
        ? current.entries.map((entry) => `<tr>
            <td class="nowrap">${fmtDate(entry.date)}</td><td><strong>${esc(entry.description)}</strong><div class="cell-sub">${esc(entry.reference)}</div></td>
            <td>${esc(entry.category)}</td><td>${esc(entry.account)}</td>
            <td class="num text-green">${entry.credit ? money(entry.credit) : "—"}</td><td class="num text-red">${entry.debit ? money(entry.debit) : "—"}</td>
            <td class="num"><strong>${money(entry.balance)}</strong></td>
          </tr>`).join("")
        : `<tr><td colspan="7">${FM.ui.emptyState("receipt", "Nenhum movimento no período", "Ajuste as datas ou escolha outra conta.")}</td></tr>`;
    }

    function exportCSV() {
      if (start > end) return;
      U.downloadCSV(`extrato-${accountId || "consolidado"}-${start}-a-${end}.csv`,
        ["Data", "Descrição", "Categoria", "Conta", "Entrada", "Saída", "Saldo após", "Referência"],
        current.entries.map((entry) => [entry.date, entry.description, entry.category, entry.account, entry.credit.toFixed(2), entry.debit.toFixed(2), entry.balance.toFixed(2), entry.reference]));
      FM.ui.toast("Extrato exportado em CSV.");
    }

    mount.innerHTML = `<div class="page-enter">
      <div class="content-head"><div><h2>Extrato por período</h2><p>Baixas, compras de cartão e transferências em um intervalo personalizado.</p></div>
        <div class="content-actions"><button class="btn ghost sm" id="statement-print">${icon("printer")}Imprimir / PDF</button><button class="btn ghost sm" id="statement-xlsx">${icon("download")}Excel</button><button class="btn primary sm" id="statement-csv">${icon("download")}CSV</button></div></div>
      <div class="print-head"><strong>Extrato — <span id="statement-account-name"></span></strong><span id="statement-range"></span></div>
      <div class="card no-print"><div class="card-body"><div class="form-grid statement-filters">
        <div class="field"><label for="statement-start">Data inicial</label><input class="input" id="statement-start" type="date" value="${start}"></div>
        <div class="field"><label for="statement-end">Data final</label><input class="input" id="statement-end" type="date" value="${end}"></div>
        <div class="field"><label for="statement-account">Conta</label><select class="select" id="statement-account"><option value="">Todas as contas</option>${st().accounts.map((account) => `<option value="${esc(account.id)}" ${account.id === accountId ? "selected" : ""}>${esc(account.name)} · ${esc(account.type)}</option>`).join("")}</select></div>
      </div><p class="small muted mt-12" id="statement-error" hidden>Informe um período válido, com a data final maior ou igual à inicial.</p></div></div>
      <div class="kpi-grid mt-16">
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Saldo inicial</span></div><div class="kpi-value" id="statement-opening">—</div><div class="kpi-foot"><span>Antes da data inicial</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Entradas</span></div><div class="kpi-value text-green" id="statement-credit">—</div><div class="kpi-foot"><span>Recebimentos e transferências recebidas</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Saídas</span></div><div class="kpi-value text-red" id="statement-debit">—</div><div class="kpi-foot"><span>Pagamentos e transferências enviadas</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Saldo final</span></div><div class="kpi-value" id="statement-closing">—</div><div class="kpi-foot"><span id="statement-count">—</span></div></article>
      </div>
      <div class="card mt-16"><div class="card-head"><div><div class="card-title">${icon("receipt")}Movimentações</div><div class="card-sub">Ordenadas por data · saldo após cada movimento</div></div></div><div class="card-body flush"><div class="table-wrap"><table class="data compact"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="num">Entrada</th><th class="num">Saída</th><th class="num">Saldo após</th></tr></thead><tbody id="statement-body"></tbody></table></div></div></div>
    </div>`;

    function update() {
      start = mount.querySelector("#statement-start").value;
      end = mount.querySelector("#statement-end").value;
      accountId = mount.querySelector("#statement-account").value;
      const invalid = !start || !end || start > end;
      mount.querySelector("#statement-error").hidden = !invalid;
      ["#statement-print", "#statement-xlsx", "#statement-csv"].forEach((selector) => { mount.querySelector(selector).disabled = invalid; });
      mount.querySelector("#statement-range").textContent = `${fmtDate(start)} a ${fmtDate(end)} · gerado em ${new Date().toLocaleString("pt-BR")}`;
      if (invalid) return;
      renderRows();
    }

    ["#statement-start", "#statement-end", "#statement-account"].forEach((selector) => mount.querySelector(selector).addEventListener("change", update));
    mount.querySelector("#statement-print").addEventListener("click", () => window.print());
    mount.querySelector("#statement-csv").addEventListener("click", exportCSV);
    mount.querySelector("#statement-xlsx").addEventListener("click", () => {
      if (start > end) return;
      FM.exports.download(`extrato-${accountId || "consolidado"}-${start}-a-${end}.xlsx`, [FM.exports.statement(current.entries, { start, end, account: accountId ? C().accountName(accountId) : "Todas as contas" })]);
      FM.ui.toast("Extrato exportado em Excel.");
    });
    update();
  };
})();

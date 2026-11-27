/* =========================================================
   MEU LAR FINANCEIRO — Transferências, fluxo de caixa, contas e conciliação
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM;
  const U = FM.utils;
  const { esc, money, moneyShort, pct, fmtDate, monthLabel, addMonthsKey, monthKeyOf, todayISO, dayDiff } = U;
  const icon = FM.ui.icon;
  const C = () => FM.calc;
  const st = () => FM.store.state;

  function accountFlow(accountId, key) {
    const calc = C();
    let entrada = 0, saida = 0;
    calc.paymentsInMonth({ month: key }).forEach(({ tx, payment }) => {
      if ((payment.account || tx.account) !== accountId) return;
      if (tx.type === "receita") entrada += U.num(payment.amount);
      else saida += U.num(payment.amount);
    });
    st().transfers.forEach((tr) => {
      if (monthKeyOf(tr.date) !== key) return;
      if (tr.fromAccount === accountId) saida += U.num(tr.amount);
      if (tr.toAccount === accountId) entrada += U.num(tr.amount);
    });
    return { entrada: U.round2(entrada), saida: U.round2(saida) };
  }

  /* =========================================================
     TRANSFERÊNCIAS
     ========================================================= */
  function openTransferForm() {
    const cat = C();
    const body = `
      <div class="form-grid">
        <div class="field"><label>Conta de origem</label><select class="select" name="fromAccount">${FM.ui.accountOptions("", false, "excludeCards")}</select></div>
        <div class="field"><label>Conta de destino</label><select class="select" name="toAccount">${FM.ui.accountOptions("ACC-002", false, "excludeCards")}</select></div>
        <div class="field"><label>Valor</label><div class="money-wrap"><span>R$</span><input class="input money" name="amount" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="field"><label>Data</label><input class="input" type="date" name="date" value="${todayISO()}"></div>
        <div class="field"><label>Taxa (opcional)</label><div class="money-wrap"><span>R$</span><input class="input money" name="fee" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="field"><label>Observação</label><input class="input" name="note" placeholder="Motivo da transferência"></div>
      </div>
      <div class="analytics-callout mt-12">${icon("info")}<span>Transferências <b>não são receita nem despesa</b>: apenas movem dinheiro entre contas. Se houver taxa, o sistema lança automaticamente uma despesa na categoria financeira, com baixa na conta de origem.</span></div>
    `;
    FM.ui.modalForm({
      title: "Nova transferência",
      subtitle: "Movimentação interna entre contas — sem impacto no resultado",
      body,
      size: "lg",
      submitLabel: "Registrar transferência",
      submitIcon: "transfer",
      onSubmit(fd) {
        FM.actions.saveTransfer({
          fromAccount: fd.get("fromAccount"),
          toAccount: fd.get("toAccount"),
          amount: fd.get("amount"),
          date: fd.get("date"),
          fee: fd.get("fee"),
          note: fd.get("note"),
        });
        FM.ui.toast("Transferência registrada.");
      },
    });
    const ov = document.querySelector(".modal-overlay");
    if (ov) {
      const from = ov.querySelector('select[name="fromAccount"]');
      const to = ov.querySelector('select[name="toAccount"]');
      const fix = () => {
        if (from.value && to.value && from.value === to.value) {
          const alt = st().accounts.find((a) => a.id !== from.value && a.active);
          if (alt) to.value = alt.id;
        }
      };
      from.addEventListener("change", fix);
      to.addEventListener("change", fix);
    }
  }

  FM.views.transferencias = function (ctx, mount) {
    const calc = C();
    const transfers = st().transfers.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const monthTransfers = transfers.filter((t) => monthKeyOf(t.date) === ctx.month);
    const totalOut = monthTransfers.reduce((s, t) => s + U.num(t.amount), 0);
    const feeTotal = monthTransfers.reduce((s, t) => s + U.num(t.fee), 0);

    const rows = transfers.length
      ? transfers.map((tr) => {
          const inMonth = monthKeyOf(tr.date) === ctx.month;
          return `<tr class="${inMonth ? "" : "row-muted"}">
            <td class="mono small muted nowrap">${esc(tr.id)}</td>
            <td class="nowrap">${fmtDate(tr.date)}</td>
            <td>
              <div class="transfer-route">
                <span class="badge muted">${esc(calc.accountName(tr.fromAccount))}</span>
                ${icon("arrow-right")}
                <span class="badge info">${esc(calc.accountName(tr.toAccount))}</span>
              </div>
              ${tr.note ? `<div class="small muted mt-8" style="margin-top:3px">${esc(tr.note)}</div>` : ""}
            </td>
            <td class="num amount">${money(tr.amount)}</td>
            <td class="num small ${U.num(tr.fee) > 0 ? "text-amber" : "muted"}">${U.num(tr.fee) > 0 ? money(tr.fee) : "—"}</td>
            <td class="actions"><button class="icon-btn sm danger" data-del-transfer="${esc(tr.id)}" title="Excluir transferência">${icon("trash")}</button></td>
          </tr>`;
        }).join("")
      : "";

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Transferências</h2><p>Movimentações entre contas da mesma organização. Não afetam receitas e despesas.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-transfer">${icon("plus")}Nova transferência</button></div>
        </div>
        <div class="kpi-grid">
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Transferido em ${esc(monthLabel(ctx.month, "short"))}</span><span class="kpi-icon cyan">${icon("transfer")}</span></div>
            <div class="kpi-value">${money(totalOut)}</div>
            <div class="kpi-foot"><span>${monthTransfers.length} operação(ões) no mês</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Taxas no mês</span><span class="kpi-icon amber">${icon("percent")}</span></div>
            <div class="kpi-value">${money(feeTotal)}</div>
            <div class="kpi-foot"><span>Lançadas como despesa financeira</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Saldo disponível</span><span class="kpi-icon green">${icon("wallet")}</span></div>
            <div class="kpi-value">${money(calc.consolidatedBalance())}</div>
            <div class="kpi-foot"><span>Transferências não alteram este total</span></div>
          </article>
        </div>
        <div class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("transfer")}Histórico de transferências</div><div class="card-sub">Todas as contas · mais recentes primeiro</div></div></div>
          <div class="card-body flush">
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>ID</th><th>Data</th><th>Percurso</th><th class="num">Valor</th><th class="num">Taxa</th><th class="actions">Ações</th></tr></thead>
                <tbody>${rows || `<tr><td colspan="6">${FM.ui.emptyState("transfer", "Nenhuma transferência", "Use transferências para registrar aportes, reforço de caixa ou retiradas entre contas — sem inflar receitas e despesas.", `<button class="btn sm subtle" id="empty-transfer">${icon("plus")}Nova transferência</button>`)}</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>
        <p class="small muted mt-12">${icon("info")} Para corrigir uma transferência, exclua e registre novamente. As taxas vinculadas são removidas junto, e o histórico da operação fica na auditoria.</p>
      </div>
    `;

    const open = () => openTransferForm();
    ["#new-transfer", "#empty-transfer"].forEach((sel) => {
      const b = mount.querySelector(sel);
      if (b) b.addEventListener("click", open);
    });
    mount.querySelectorAll("[data-del-transfer]").forEach((b) => {
      b.addEventListener("click", async () => {
        const tr = st().transfers.find((t) => t.id === b.dataset.delTransfer);
        if (!tr) return;
        const ok = await FM.ui.confirm({
          title: "Excluir transferência",
          message: `A transferência ${esc(tr.id)} de ${esc(money(tr.amount))} será removida, junto com a taxa vinculada (se houver). O histórico fica registrado na auditoria.`,
          confirmLabel: "Excluir",
          danger: true,
        });
        if (!ok) return;
        try {
          FM.actions.deleteTransfer(tr.id);
          FM.ui.toast("Transferência excluída.", "info");
        } catch (err) {
          FM.ui.toast(err.message, "error");
        }
      });
    });
  };

  /* =========================================================
     FLUXO DE CAIXA
     ========================================================= */
  FM.views["fluxo-caixa"] = function (ctx, mount) {
    const calc = C();
    const boundary = monthKeyOf(todayISO());
    const keys = U.lastMonthKeys(12, addMonthsKey(ctx.month, 6));
    const stats = calc.monthlySeries(keys);
    const byKey = {};
    stats.forEach((s) => (byKey[s.key] = s));

    const projMap = {};
    let run = calc.monthStats(boundary).saldoProjetado;
    keys.forEach((k) => {
      if (k < boundary) projMap[k] = byKey[k].saldoFinal;
      else if (k === boundary) projMap[k] = run;
      else {
        run = U.round2(run + byKey[k].entradasPrevistas - byKey[k].saidasPrevistas);
        projMap[k] = run;
      }
    });

    const current = calc.monthStats(ctx.month);
    const proj3Key = addMonthsKey(ctx.month, 3);
    const proj3 = projMap[proj3Key] != null ? projMap[proj3Key] : projMap[keys[keys.length - 1]];
    const cash = calc.consolidatedBalance();
    const next = calc.monthStats(addMonthsKey(ctx.month, 1));
    const last3 = U.lastMonthKeys(3, ctx.month).map((k) => calc.monthStats(k).despesasPagas);
    const avgExp = U.mean(last3);
    const runway = avgExp > 0 ? cash / avgExp : 0;
    const minProj = Math.min(...keys.map((k) => projMap[k]));

    const rows = stats.map((s) => {
      const isFuture = s.key > boundary;
      const isCurrent = s.key === boundary;
      return `<tr class="${isFuture ? "row-muted" : ""}" ${isCurrent ? 'style="background:var(--primary-soft)"' : ""}>
        <td class="nowrap"><b>${esc(monthLabel(s.key, "long"))}</b>${isCurrent ? ` <span class="badge primary" style="margin-left:6px">Atual</span>` : isFuture ? ` <span class="badge muted">Projeção</span>` : ""}</td>
        <td class="num amount pos">${money(s.receitasRecebidas)}</td>
        <td class="num amount neg">${money(s.despesasPagas)}</td>
        <td class="num amount ${s.resultado >= 0 ? "pos" : "neg"}">${money(s.resultado)}</td>
        <td class="num small muted">${money(s.entradasPrevistas)}</td>
        <td class="num small muted">${money(s.saidasPrevistas)}</td>
        <td class="num amount">${money(projMap[s.key])}</td>
      </tr>`;
    }).join("");

    const totals = stats.reduce((acc, s) => {
      if (s.key <= boundary) {
        acc.rec += s.receitasRecebidas;
        acc.desp += s.despesasPagas;
      }
      acc.ent += s.entradasPrevistas;
      acc.sai += s.saidasPrevistas;
      return acc;
    }, { rec: 0, desp: 0, ent: 0, sai: 0 });

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Fluxo de caixa</h2><p>Realizado e projetado — visão de 12 meses com títulos em aberto.</p></div>
          <div class="content-actions">
            <button class="btn ghost sm" id="flow-print">${icon("printer")}Imprimir</button>
            <button class="btn ghost sm" id="flow-export">${icon("download")}Exportar</button>
          </div>
        </div>
        <div class="print-head"><strong>Fluxo de caixa — ${esc(monthLabel(ctx.month, "long"))}</strong><span>Meu Lar Financeiro · gerado em ${fmtDate(todayISO())}</span></div>

        <div class="kpi-grid">
          <article class="kpi hero">
            <div class="kpi-head"><span class="kpi-label">Saldo em caixa hoje</span><span class="kpi-icon green">${icon("wallet")}</span></div>
            <div class="kpi-value ${cash < 0 ? "neg" : ""}">${money(cash)}</div>
            <div class="kpi-foot"><span>${runway > 0 ? `Cobre ≈ ${runway.toFixed(1)} mês(es) de despesa média` : "Cadastre despesas para calcular a reserva"}</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Resultado de ${esc(monthLabel(ctx.month, "short"))}</span><span class="kpi-icon ${current.resultado >= 0 ? "green" : "red"}">${icon(current.resultado >= 0 ? "trending-up" : "trending-down")}</span></div>
            <div class="kpi-value ${current.resultado >= 0 ? "pos" : "neg"}">${money(current.resultado)}</div>
            <div class="kpi-foot"><span>Recebido ${moneyShort(current.receitasRecebidas)} · pago ${moneyShort(current.despesasPagas)}</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Saldo projetado em 3 meses</span><span class="kpi-icon ${proj3 >= 0 ? "cyan" : "red"}">${icon("flag")}</span></div>
            <div class="kpi-value ${proj3 >= 0 ? "" : "neg"}">${money(proj3)}</div>
            <div class="kpi-foot"><span>${esc(monthLabel(proj3Key, "long"))} · inclui títulos em aberto</span></div>
          </article>
          <article class="kpi">
            <div class="kpi-head"><span class="kpi-label">Próximo mês — previstos</span><span class="kpi-icon amber">${icon("calendar")}</span></div>
            <div class="kpi-value" style="font-size:19px">${moneyShort(next.entradasPrevistas)} <span class="muted" style="font-size:13px">−</span> ${moneyShort(next.saidasPrevistas)}</div>
            <div class="kpi-foot"><span>${next.countReceber} a receber · ${next.countPagar} a pagar</span></div>
          </article>
        </div>

        <div class="grid grid-main mt-16">
          <section class="card">
            <div class="card-head">
              <div><div class="card-title">${icon("trending-up")}Saldo do caixa</div><div class="card-sub">Realizado até hoje e projeção pelos vencimentos em aberto</div></div>
            </div>
            <div class="card-body">
              ${FM.charts.area({
                labels: stats.map((s) => s.label),
                series: [{ name: "Saldo de caixa", values: keys.map((k) => projMap[k]), color: "#d96faa", dot: true }],
                height: 250,
                zero: false,
              })}
              ${FM.charts.legend([
                { name: "Saldo realizado / projetado", color: "#d96faa" },
                { name: minProj < 0 ? "Atenção: projeção negativa" : "Projeção positiva", color: minProj < 0 ? "#e27c94" : "#48ad8c" },
              ])}
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon("scale")}Receitas x despesas</div><div class="card-sub">Valores realizados por mês</div></div></div>
            <div class="card-body">
              ${FM.charts.bars({
                labels: stats.map((s) => s.label),
                series: [
                  { name: "Receitas", values: stats.map((s) => s.receitasRecebidas), color: "#48ad8c" },
                  { name: "Despesas", values: stats.map((s) => s.despesasPagas), color: "#e27c94" },
                ],
                height: 250,
              })}
              ${FM.charts.legend([{ name: "Receitas recebidas", color: "#48ad8c" }, { name: "Despesas pagas", color: "#e27c94" }])}
            </div>
          </section>
        </div>

        ${minProj < 0 ? `<div class="alert-strip danger mt-16"><div class="alert-icon">${icon("alert")}</div><div class="alert-text"><strong>Projeção de caixa negativa em algum mês</strong><span>O menor saldo projetado no período é ${money(minProj)}. Antecipe recebíveis, renegocie prazos ou reduza despesas discricionárias.</span></div><a class="btn sm" href="#/a-pagar">Revisar contas</a></div>` : ""}

        <div class="card mt-16">
          <div class="card-head"><div><div class="card-title">${icon("calendar")}Tabela mensal</div><div class="card-sub">Realizado, previsto e saldo projetado</div></div></div>
          <div class="card-body flush">
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Mês</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Resultado</th><th class="num">A receber</th><th class="num">A pagar</th><th class="num">Saldo proj.</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr>
                  <td>Acumulado realizado</td>
                  <td class="num amount pos">${money(totals.rec)}</td>
                  <td class="num amount neg">${money(totals.desp)}</td>
                  <td class="num amount">${money(totals.rec - totals.desp)}</td>
                  <td class="num">${money(totals.ent)}</td>
                  <td class="num">${money(totals.sai)}</td>
                  <td class="num">${money(projMap[keys[keys.length - 1]])}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </div>

        <div class="grid grid-2 mt-16">
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("sparkles")}Como ler esta projeção</div>
            <ul class="tip-list mt-8">
              <li><b>Saldo de caixa</b>: posição real de todas as contas até hoje, incluindo transferências.</li>
              <li><b>Projeção</b>: soma os títulos em aberto pela data de vencimento, sem contar duas vezes o que já foi baixado.</li>
              <li><b>Resultado</b> considera apenas valores efetivamente recebidos e pagos no mês — não é o mesmo que saldo.</li>
            </ul>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("shield")}Dicas de controle futuro</div>
            <ul class="tip-list mt-8">
              <li>Mantenha de 3 a 6 meses de despesas médias em reserva. Hoje: <b>${runway > 0 ? runway.toFixed(1) + " mês(es)" : "—"}</b>.</li>
              <li>Revise os vencimentos dos próximos ${FM.calc.notificationSettings().dueDays} dias antes de autorizar novos gastos.</li>
              <li>Cadastre receitas previstas assim que forem contratadas: a projeção antecipa apertos de caixa.</li>
              <li>Nunca use a conta de reserva para despesa operacional sem registrar a transferência.</li>
            </ul>
          </div></div>
        </div>
      </div>
    `;

    mount.querySelector("#flow-print").addEventListener("click", () => window.print());
    mount.querySelector("#flow-export").addEventListener("click", () => {
      U.downloadCSV(`meu-lar-financeiro-fluxo-${ctx.month}.csv`,
        ["Mês", "Receitas recebidas", "Despesas pagas", "Resultado", "A receber", "A pagar", "Saldo projetado"],
        stats.map((s) => [monthLabel(s.key, "long"), money(s.receitasRecebidas), money(s.despesasPagas), money(s.resultado), money(s.entradasPrevistas), money(s.saidasPrevistas), money(projMap[s.key])]));
      FM.ui.toast("Fluxo de caixa exportado em CSV.");
    });
  };

  /* =========================================================
     CONTAS BANCÁRIAS
     ========================================================= */
  function openAccountForm(acc) {
    const active = !acc || acc.active !== false;
    const types = ["Conta corrente", "Poupança", "Caixa", "Cartão de crédito", "Investimento", "Outro"];
    const body = `
      <div class="form-grid">
        <div class="field full"><label>Nome da conta</label><input class="input" name="name" value="${acc ? esc(acc.name) : ""}" placeholder="Ex.: Banco principal"></div>
        <div class="field"><label>Instituição</label><input class="input" name="institution" value="${acc ? esc(acc.institution) : ""}" placeholder="Ex.: Banco do Brasil"></div>
        <div class="field"><label>Tipo</label><select class="select" name="type">
          ${types.map((t) => `<option ${acc && acc.type === t ? "selected" : ""}>${t}</option>`).join("")}
        </select></div>
        <div class="field"><label>Saldo inicial</label><div class="money-wrap"><span>R$</span><input class="input money" name="openingBalance" inputmode="decimal" value="${acc ? String(acc.openingBalance).replace(".", ",") : "0,00"}"></div></div>
        <div class="field"><label>Situação</label><label class="check" style="height:38px"><input type="checkbox" name="active" ${active ? "checked" : ""}> Conta ativa</label></div>
        <div class="card-form-fields full" data-card-fields ${acc?.type === "Cartão de crédito" ? "" : "hidden"}>
          <div class="form-grid">
            <div class="field"><label>Limite (0 = não configurado)</label><div class="money-wrap"><span>R$</span><input class="input money" name="limit" inputmode="decimal" value="${acc ? String(acc.limit || 0).replace(".", ",") : "0,00"}"></div></div>
            <div class="field"><label>Bandeira</label><input class="input" name="brand" value="${acc ? esc(acc.brand || "") : ""}" placeholder="Ex.: Mastercard"></div>
            <div class="field"><label>Dia de fechamento</label><input class="input" type="number" min="1" max="31" name="closingDay" value="${acc?.closingDay || 31}"></div>
            <div class="field"><label>Dia de vencimento</label><input class="input" type="number" min="1" max="31" name="dueDay" value="${acc?.dueDay || 31}"></div>
            <div class="field full"><label>Cor do cartão</label><input class="input" type="color" name="color" value="${/^#[0-9a-f]{6}$/i.test(acc?.color || "") ? acc.color : "#7c6a9c"}"></div>
          </div>
        </div>
      </div>
      ${FM.attachments?.available() ? (acc ? `<div class="form-section" data-attachment-manager="account:${esc(acc.id)}"></div>` : FM.attachments.inputField()) : ""}
      <p class="modal-note mt-12">O saldo inicial é a posição da conta antes do primeiro lançamento registrado. O saldo atual é calculado automaticamente.</p>
    `;
    FM.ui.modalForm({
      title: acc ? "Editar conta" : "Nova conta",
      subtitle: acc ? `${acc.id} · saldo atual ${money(C().accountBalance(acc.id))}` : "Cadastre contas e caixas para acompanhar saldos individualmente.",
      body,
      size: "lg",
      submitLabel: acc ? "Salvar alterações" : "Criar conta",
      submitIcon: "check",
      async onSubmit(fd, form) {
        const saved = await FM.actions.saveAccount({
          name: fd.get("name"),
          institution: fd.get("institution"),
          type: fd.get("type"),
          openingBalance: fd.get("openingBalance"),
          active: !!fd.get("active"),
          limit: fd.get("limit"),
          brand: fd.get("brand"),
          closingDay: fd.get("closingDay"),
          dueDay: fd.get("dueDay"),
          color: fd.get("color"),
        }, acc ? acc.id : null);
        const files = [...(form.querySelector("[data-attachment-input]")?.files || [])];
        if (files.length) {
          try { await FM.attachments.upload("account", saved.id, files); }
          catch (error) { FM.ui.toast("A conta foi salva, mas o comprovante não foi enviado. Tente novamente ao editar a conta.", "error"); }
        }
        FM.ui.toast(acc ? "Conta atualizada." : "Conta criada.");
      },
      onMount(ov, close, form) {
        const attachmentManager = ov.querySelector("[data-attachment-manager]");
        if (attachmentManager) FM.attachments.mount(attachmentManager, "account", acc.id);
        const type = form.querySelector('select[name="type"]');
        const fields = form.querySelector("[data-card-fields]");
        type.addEventListener("change", () => { fields.hidden = type.value !== "Cartão de crédito"; });
      },
    });
  }

  FM.views.contas = function (ctx, mount) {
    const calc = C();
    const accounts = st().accounts;
    const total = calc.consolidatedBalance();
    let entradaMes = 0, saidaMes = 0;
    accounts.filter((a) => calc.isCashAccount(a)).forEach((a) => {
      const f = accountFlow(a.id, ctx.month);
      entradaMes += f.entrada;
      saidaMes += f.saida;
    });

    const cards = accounts.map((a) => {
      const bal = calc.accountBalance(a.id);
      const flow = accountFlow(a.id, ctx.month);
      const share = total !== 0 ? bal / total : 0;
      const isCard = a.type === "Cartão de crédito";
      const limit = isCard ? calc.cardSummary(a.id) : null;
      return `<article class="account-card">
        <div class="account-top">
          <div>
            <div class="account-name">${esc(a.name)}</div>
            <div class="account-inst">${esc(a.institution || a.type)} · ${esc(a.type)}</div>
          </div>
          <div class="row" style="gap:4px">
            <span class="badge ${a.active ? "ok" : "muted"}">${a.active ? "Ativa" : "Inativa"}</span>
            <button class="icon-btn sm" data-edit-acc="${esc(a.id)}" title="Editar conta">${icon("edit")}</button>
          </div>
        </div>
        <div class="account-balance ${bal < 0 ? "text-red" : ""}">${money(bal)}</div>
        <div class="small muted">${isCard ? `Limite utilizado ${money(limit.used)} de ${limit.total > 0 ? money(limit.total) : "não configurado"} · disponível ${money(limit.available)}` : a.type === "Investimento" ? "Saldo de investimento" : `${pct(Math.abs(share))} do saldo disponível`}</div>
        <div class="account-foot">
          <span>${icon("arrow-up")} +${moneyShort(flow.entrada)}</span>
          <span>${icon("arrow-down")} −${moneyShort(flow.saida)}</span>
          <span>${esc(monthLabel(ctx.month, "short"))}</span>
        </div>
        <div class="mt-12" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm subtle" data-view-acc="${esc(a.id)}">${icon("receipt")}Lançamentos</button>
          ${isCard ? `<button class="btn sm ghost" data-card-detail="${esc(a.id)}">${icon("credit-card")}Faturas</button>` : ""}
          <button class="btn sm ghost" data-toggle-acc="${esc(a.id)}">${a.active ? "Desativar" : "Reativar"}</button>
        </div>
      </article>`;
    }).join("");

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Contas e investimentos</h2><p>Acompanhe saldo disponível, faturas dos cartões e valores reservados ou investidos.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-account">${icon("plus")}Nova conta</button></div>
        </div>
        <div class="summary-row" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;padding:14px 18px">
          <div class="mini-stat"><span>Saldo disponível</span><strong class="${total < 0 ? "text-red" : "text-green"}">${money(total)}</strong></div>
          <div class="mini-stat"><span>Contas ativas</span><strong>${accounts.filter((a) => a.active).length} de ${accounts.length}</strong></div>
          <div class="mini-stat"><span>Entradas em ${esc(monthLabel(ctx.month, "short"))}</span><strong class="text-green">${money(entradaMes)}</strong></div>
          <div class="mini-stat"><span>Saídas em ${esc(monthLabel(ctx.month, "short"))}</span><strong class="text-red">${money(saidaMes)}</strong></div>
        </div>
        ${accounts.length ? `<div class="account-grid">${cards}</div>` : `<div class="card">${FM.ui.emptyState("bank", "Nenhuma conta cadastrada", "Cadastre pelo menos uma conta para registrar lançamentos e acompanhar o saldo.", `<button class="btn primary" id="empty-account">${icon("plus")}Criar conta</button>`)}</div>`}
        <div class="card mt-16"><div class="card-body">
          <div class="card-title">${icon("info")}Como o saldo é calculado</div>
          <ul class="tip-list mt-8">
            <li><b>Saldo disponível</b> soma contas e caixa; cartões e investimentos ficam separados.</li>
            <li><b>Fatura do cartão</b> reúne as compras por competência. O caixa muda quando a fatura é paga em <b>Cartões e faturas</b>.</li>
            <li><b>Investimentos</b> recebem transferências e não entram como receita ou despesa.</li>
            <li>Lançamentos <b>previstos</b> não alteram o saldo até serem baixados — use o fluxo de caixa para ver o projetado.</li>
          </ul>
        </div></div>
      </div>
    `;

    const openNew = () => openAccountForm(null);
    ["#new-account", "#empty-account"].forEach((sel) => {
      const b = mount.querySelector(sel);
      if (b) b.addEventListener("click", openNew);
    });
    mount.querySelectorAll("[data-edit-acc]").forEach((b) => {
      b.addEventListener("click", () => {
        const acc = accounts.find((a) => a.id === b.dataset.editAcc);
        if (acc) openAccountForm(acc);
      });
    });
    mount.querySelectorAll("[data-toggle-acc]").forEach((b) => {
      b.addEventListener("click", async () => {
        const acc = accounts.find((a) => a.id === b.dataset.toggleAcc);
        if (!acc) return;
        if (acc.active) {
          const ok = await FM.ui.confirm({
            title: "Desativar conta",
            message: `A conta "${esc(acc.name)}" deixará de aparecer em novos lançamentos. O histórico e o saldo continuam preservados.`,
            confirmLabel: "Desativar",
          });
          if (!ok) return;
        }
        FM.actions.toggleAccount(acc.id);
        FM.ui.toast(acc.active ? "Conta desativada." : "Conta reativada.", "info");
      });
    });
    mount.querySelectorAll("[data-card-detail]").forEach((b) => {
      b.addEventListener("click", () => FM.app.go(`cartoes?card=${encodeURIComponent(b.dataset.cardDetail)}`));
    });
    mount.querySelectorAll("[data-view-acc]").forEach((b) => {
      b.addEventListener("click", () => {
        const F = FM.store.ui.txFilters;
        F.account = b.dataset.viewAcc;
        F.period = "all";
        F.type = "all";
        F.status = "all";
        F.category = "all";
        F.section = "all";
        F.q = "";
        location.hash = "#/lancamentos";
      });
    });
  };

  /* =========================================================
     CONCILIAÇÃO
     ========================================================= */
  function openReconciliationForm(rec) {
    const body = `
      <div class="form-grid">
        <div class="field"><label>Data</label><input class="input" type="date" name="date" value="${rec ? rec.date : todayISO()}"></div>
        <div class="field"><label>Conta</label><select class="select" name="account">${FM.ui.accountOptions(rec ? rec.account : "")}</select></div>
        <div class="field full"><label>Descrição no extrato</label><input class="input" name="description" value="${rec ? esc(rec.description) : ""}" placeholder="Ex.: TED recebida, boleto, tarifa..."></div>
        <div class="field"><label>Valor no extrato</label><div class="money-wrap"><span>R$</span><input class="input money" name="statementAmount" inputmode="decimal" value="${rec ? String(rec.statementAmount).replace(".", ",") : ""}" placeholder="0,00 ou -0,00"></div><span class="hint">Saídas do extrato (débitos) devem ser negativas.</span></div>
        <div class="field"><label>Valor no sistema</label><div class="money-wrap"><span>R$</span><input class="input money" name="systemAmount" inputmode="decimal" value="${rec ? String(rec.systemAmount).replace(".", ",") : "0,00"}" placeholder="0,00"></div><span class="hint">Deixe 0,00 se ainda não houver lançamento correspondente.</span></div>
        <div class="field full"><label class="check"><input type="checkbox" name="reconciled" ${rec && rec.reconciled ? "checked" : ""}> Marcar como conciliado</label></div>
        <div class="field full"><label>Observação</label><input class="input" name="note" value="${rec ? esc(rec.note) : ""}" placeholder="Diferença identificada, ação pendente..."></div>
      </div>
    `;
    FM.ui.modalForm({
      title: rec ? "Editar conciliação" : "Novo item de conciliação",
      subtitle: "Compare o extrato bancário com os lançamentos do sistema",
      body,
      size: "lg",
      submitLabel: rec ? "Salvar" : "Adicionar item",
      submitIcon: "check",
      onSubmit(fd) {
        FM.actions.saveReconciliation({
          date: fd.get("date"),
          account: fd.get("account"),
          description: fd.get("description"),
          statementAmount: fd.get("statementAmount"),
          systemAmount: fd.get("systemAmount"),
          reconciled: !!fd.get("reconciled"),
          note: fd.get("note"),
        }, rec ? rec.id : null);
        FM.ui.toast(rec ? "Conciliação atualizada." : "Item de conciliação adicionado.");
      },
    });
  }

  FM.views.conciliacao = function (ctx, mount) {
    let filter = "pending";
    const calc = C();
    const all = st().reconciliations;
    const diffOf = (r) => U.round2(U.num(r.statementAmount) - U.num(r.systemAmount));

    function collect() {
      const list = all.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      if (filter === "pending") return list.filter((r) => !r.reconciled);
      if (filter === "done") return list.filter((r) => r.reconciled);
      return list;
    }
    const pending = all.filter((r) => !r.reconciled);
    const pendingDiff = pending.reduce((s, r) => s + Math.abs(diffOf(r)), 0);

    mount.innerHTML = `
      <div class="page-enter">
        <div class="content-head">
          <div><h2>Conciliação bancária</h2><p>Compare o extrato com o sistema e resolva divergências antes que virem erros de saldo.</p></div>
          <div class="content-actions"><button class="btn primary sm" id="new-rec">${icon("plus")}Novo item</button></div>
        </div>
        ${pending.length ? `<div class="alert-strip warn"><div class="alert-icon">${icon("scale")}</div><div class="alert-text"><strong>${pending.length} item(ns) pendente(s) · ${money(pendingDiff)} de diferença absoluta</strong><span>Itens não conciliados devem ser investigados: podem indicar lançamento faltante, valor incorreto ou tarifa não registrada.</span></div></div>` : ""}
        <div class="summary-row" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;padding:14px 18px">
          <div class="mini-stat"><span>Itens no extrato</span><strong>${all.length}</strong></div>
          <div class="mini-stat"><span>Conciliados</span><strong class="text-green">${all.filter((r) => r.reconciled).length}</strong></div>
          <div class="mini-stat"><span>Pendentes</span><strong class="text-amber">${pending.length}</strong></div>
          <div class="mini-stat"><span>Diferença pendente</span><strong class="text-red">${money(pendingDiff)}</strong></div>
        </div>
        <div class="card">
          <div class="toolbar">
            <div class="segmented" id="rec-filter">
              <button type="button" data-f="pending" class="active">Pendentes</button>
              <button type="button" data-f="done">Conciliados</button>
              <button type="button" data-f="all">Todos</button>
            </div>
            <div class="toolbar-end"><span class="small muted">Diferença = extrato − sistema</span></div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th class="num">Extrato</th><th class="num">Sistema</th><th class="num">Diferença</th><th>Status</th><th class="actions">Ações</th></tr></thead>
              <tbody id="rec-body"></tbody>
            </table>
          </div>
        </div>
        <div class="grid grid-2 mt-16">
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("check-circle")}Rotina de conciliação</div>
            <ul class="tip-list mt-8">
              <li>Exporte o extrato e importe aqui um item por movimentação relevante.</li>
              <li>Confira <b>data</b>, <b>valor</b> e <b>sentido</b> (crédito/débito). Diferença zero = conciliado.</li>
              <li>Se o sistema não tem o lançamento, registre-o em Lançamentos e atualize o valor do sistema.</li>
              <li>Feche a conciliação do mês antes de gerar o DRE — o saldo fica confiável.</li>
            </ul>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="card-title">${icon("alert")}O que a diferença costuma indicar</div>
            <ul class="tip-list mt-8">
              <li><b>Tarifas e juros</b> debitados pelo banco mas não lançados → registre como despesa financeira.</li>
              <li><b>Cheque ou boleto compensado</b> depois da baixa → ajuste a data de pagamento.</li>
              <li><b>Depósito não identificado</b> → cadastre receipt provisório e classifique depois.</li>
              <li><b>Transferência entre contas</b> vista como crédito e débito → nunca lance como receita/despesa.</li>
            </ul>
          </div></div>
        </div>
      </div>
    `;

    const body = mount.querySelector("#rec-body");
    function render() {
      const list = collect();
      body.innerHTML = list.length
        ? list.map((r) => {
            const diff = diffOf(r);
            return `<tr class="${r.reconciled ? "row-muted" : ""}">
              <td class="nowrap">${fmtDate(r.date)}</td>
              <td><div class="cell-title">${esc(r.description)}</div>${r.note ? `<div class="cell-sub">${esc(r.note)}</div>` : ""}</td>
              <td class="small nowrap">${esc(calc.accountName(r.account))}</td>
              <td class="num amount ${U.num(r.statementAmount) < 0 ? "neg" : "pos"}">${money(r.statementAmount)}</td>
              <td class="num amount ${U.num(r.systemAmount) < 0 ? "neg" : "pos"}">${money(r.systemAmount)}</td>
              <td class="num amount ${Math.abs(diff) > 0.005 ? "text-red" : "muted"}">${money(diff)}</td>
              <td>${r.reconciled ? `<span class="badge ok"><span class="dot"></span>Conciliado</span>` : Math.abs(diff) > 0.005 ? `<span class="badge danger"><span class="dot"></span>Divergente</span>` : `<span class="badge warn"><span class="dot"></span>Pendente</span>`}</td>
              <td class="actions">
                <button class="icon-btn sm" data-toggle-rec="${esc(r.id)}" title="${r.reconciled ? "Reabrir" : "Marcar conciliado"}">${icon(r.reconciled ? "refresh" : "check")}</button>
                <button class="icon-btn sm" data-edit-rec="${esc(r.id)}" title="Editar">${icon("edit")}</button>
                <button class="icon-btn sm danger" data-del-rec="${esc(r.id)}" title="Excluir">${icon("trash")}</button>
              </td>
            </tr>`;
          }).join("")
        : `<tr><td colspan="8">${FM.ui.emptyState("check-circle", "Tudo conciliado", filter === "pending" ? "Não há itens pendentes. Continue comparando o extrato todo mês." : "Nenhum item neste filtro.", `<button class="btn sm subtle" id="empty-rec">${icon("plus")}Adicionar item</button>`)}</td></tr>`;

      const emptyBtn = body.querySelector("#empty-rec");
      if (emptyBtn) emptyBtn.addEventListener("click", () => openReconciliationForm(null));
      body.querySelectorAll("[data-toggle-rec]").forEach((b) => {
        b.addEventListener("click", () => {
          const r = all.find((x) => x.id === b.dataset.toggleRec);
          if (!r) return;
          const diff = diffOf(r);
          if (!r.reconciled && Math.abs(diff) > 0.005) {
            FM.ui.confirm({
              title: "Conciliar com diferença",
              message: `Este item ainda tem diferença de ${esc(money(diff))}. Conciliar assim mesmo? O ideal é ajustar o lançamento correspondente antes.`,
              confirmLabel: "Conciliar mesmo assim",
            }).then((ok) => {
              if (ok) FM.actions.toggleReconciliation(r.id);
            });
            return;
          }
          FM.actions.toggleReconciliation(r.id);
          FM.ui.toast(r.reconciled ? "Conciliação reaberta." : "Item conciliado.", "info");
        });
      });
      body.querySelectorAll("[data-edit-rec]").forEach((b) => {
        b.addEventListener("click", () => {
          const r = all.find((x) => x.id === b.dataset.editRec);
          if (r) openReconciliationForm(r);
        });
      });
      body.querySelectorAll("[data-del-rec]").forEach((b) => {
        b.addEventListener("click", async () => {
          const r = all.find((x) => x.id === b.dataset.delRec);
          if (!r) return;
          const ok = await FM.ui.confirm({
            title: "Excluir item",
            message: `O item "${esc(r.description)}" será removido da conciliação. Essa ação fica registrada na auditoria.`,
            confirmLabel: "Excluir",
            danger: true,
          });
          if (!ok) return;
          FM.actions.deleteReconciliation(r.id);
          FM.ui.toast("Item excluído.", "info");
        });
      });
    }

    mount.querySelectorAll("#rec-filter button").forEach((b) => {
      b.addEventListener("click", () => {
        filter = b.dataset.f;
        mount.querySelectorAll("#rec-filter button").forEach((x) => x.classList.toggle("active", x === b));
        render();
      });
    });
    mount.querySelector("#new-rec").addEventListener("click", () => openReconciliationForm(null));
    render();
  };
})();

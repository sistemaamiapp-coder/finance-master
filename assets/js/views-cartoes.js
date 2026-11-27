(function () {
  "use strict";
  const FM = window.FM;
  const { esc, money, fmtDate, monthLabel, todayISO, num } = FM.utils;
  const icon = FM.ui.icon;
  const st = () => FM.store.state;
  const calc = () => FM.calc;
  let selectedCardId = "";
  let selectedInvoiceMonth = "";

  function cardForm(card) {
    const editing = !!card;
    FM.ui.modalForm({
      title: editing ? "Editar cartão" : "Novo cartão",
      subtitle: "Limite zero significa que nenhum limite foi configurado.",
      size: "lg",
      submitLabel: editing ? "Salvar cartão" : "Criar cartão",
      submitIcon: "credit-card",
      body: `<div class="form-grid">
        <div class="field full"><label>Nome do cartão</label><input class="input" name="name" maxlength="100" value="${esc(card?.name || "")}" placeholder="Ex.: Cartão principal"></div>
        <div class="field"><label>Instituição</label><input class="input" name="institution" value="${esc(card?.institution || "")}" placeholder="Ex.: Nubank"></div>
        <div class="field"><label>Bandeira</label><input class="input" name="brand" value="${esc(card?.brand || "")}" placeholder="Ex.: Mastercard"></div>
        <div class="field"><label>Limite</label><div class="money-wrap"><span>R$</span><input class="input money" name="limit" inputmode="decimal" value="${String(card?.limit || 0).replace(".", ",")}"></div></div>
        <div class="field"><label>Fechamento</label><input class="input" type="number" min="1" max="31" name="closingDay" value="${card?.closingDay || 31}"></div>
        <div class="field"><label>Vencimento</label><input class="input" type="number" min="1" max="31" name="dueDay" value="${card?.dueDay || 31}"></div>
        <div class="field"><label>Cor</label><input class="input" type="color" name="color" value="${/^#[0-9a-f]{6}$/i.test(card?.color || "") ? card.color : "#7c6a9c"}"></div>
        <div class="field"><label>Situação</label><label class="check" style="height:38px"><input type="checkbox" name="active" ${!card || card.active !== false ? "checked" : ""}> Cartão ativo</label></div>
      </div>
      <div class="analytics-callout mt-12">${icon("shield")}<span>Com limite configurado, o sistema bloqueia compras que ultrapassem o valor disponível. Não armazene número do cartão, CVV ou PIN.</span></div>`,
      async onSubmit(fd) {
        await FM.actions.saveAccount({
          name: fd.get("name"), institution: fd.get("institution"), type: "Cartão de crédito",
          openingBalance: 0, active: !!fd.get("active"), limit: fd.get("limit"), brand: fd.get("brand"),
          closingDay: fd.get("closingDay"), dueDay: fd.get("dueDay"), color: fd.get("color"),
        }, card?.id || null);
        FM.ui.toast(editing ? "Cartão atualizado." : "Cartão criado.");
      },
    });
  }

  function purchaseForm(purchaseId, presetCardId) {
    const items = purchaseId ? st().accounts.filter((account) => account.type === "Cartão de crédito").flatMap((account) => calc().cardPurchases(account.id)).find((group) => group[0].cardPurchaseId === purchaseId) : null;
    const current = items?.[0];
    const cards = st().accounts.filter((account) => account.type === "Cartão de crédito" && (account.active || account.id === current?.account));
    if (!cards.length) {
      FM.ui.toast("Cadastre um cartão antes de registrar a compra.", "warn");
      return cardForm(null);
    }
    const cardId = current?.account || presetCardId || cards[0].id;
    const count = current?.installmentCount || 1;
    FM.ui.modalForm({
      title: current ? "Editar compra" : "Nova compra no cartão",
      subtitle: current ? `${esc(purchaseId)} · as parcelas serão realocadas conforme a data e o fechamento` : "A compra compromete o limite; o caixa muda apenas quando a fatura é paga.",
      size: "lg",
      submitLabel: current ? "Salvar compra" : "Registrar compra",
      submitIcon: "credit-card",
      body: `<div class="form-grid">
        <div class="field full"><label>Descrição</label><input class="input" name="description" maxlength="140" value="${esc(current?.description?.replace(/\s*\(\d+\/\d+\)$/, "") || "")}" placeholder="Ex.: Supermercado, farmácia ou eletrônico"></div>
        <div class="field"><label>Cartão</label><select class="select" name="account">${cards.map((card) => `<option value="${esc(card.id)}" ${card.id === cardId ? "selected" : ""}>${esc(card.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Data da compra</label><input class="input" type="date" name="date" value="${current?.purchaseDate || current?.date || todayISO()}"></div>
        <div class="field"><label>Valor total</label><div class="money-wrap"><span>R$</span><input class="input money" name="total" inputmode="decimal" value="${String(current?.purchaseTotal || "").replace(".", ",")}"></div></div>
        <div class="field"><label>Parcelas</label><input class="input" type="number" min="1" max="60" name="installments" value="${count}"></div>
        <div class="field"><label>Categoria</label><select class="select" name="category">${FM.ui.categoryOptions("despesa", current?.category || "", current?.subcategory || "")}</select></div>
        <div class="field"><label>Centro de custo</label><select class="select" name="costCenter">${FM.ui.costCenterOptions(current?.costCenter || "")}</select></div>
        <div class="field full"><label>Observação</label><input class="input" name="note" maxlength="180" value="${esc(current?.note || "")}"></div>
      </div>
      ${FM.attachments?.available() ? (current ? `<div class="form-section full" data-attachment-manager="card_purchase:${esc(current.cardPurchaseId || purchaseId)}"></div>` : FM.attachments.inputField()) : ""}
      <div class="analytics-callout mt-12" data-purchase-preview>${icon("info")}<span>Informe data, valor e parcelas para visualizar a alocação.</span></div>`,
      onMount(ov, close, form) {
        const attachmentManager = ov.querySelector("[data-attachment-manager]");
        if (attachmentManager) FM.attachments.mount(attachmentManager, "card_purchase", current.cardPurchaseId || purchaseId);
        const preview = ov.querySelector("[data-purchase-preview]");
        const update = () => {
          const card = calc().accountById(form.elements.account.value);
          const date = form.elements.date.value;
          const quantity = Math.max(1, Math.min(60, Math.floor(num(form.elements.installments.value) || 1)));
          if (!card || !date) return;
          const first = calc().invoiceMonthForDate(card, date);
          const last = FM.utils.addMonthsKey(first, quantity - 1);
          preview.innerHTML = `${icon("calendar")}<span><b>${quantity} parcela(s)</b> · faturas de ${esc(monthLabel(first, "short"))} até ${esc(monthLabel(last, "short"))}. Vencimentos calculados pelo cartão.</span>`;
        };
        ["account", "date", "installments"].forEach((name) => form.elements[name].addEventListener("change", update));
        update();
      },
      async onSubmit(fd) {
        const [category, subcategory] = String(fd.get("category") || "").split("||");
        const result = await FM.actions.saveCardPurchase({
          description: fd.get("description"), account: fd.get("account"), date: fd.get("date"),
          total: fd.get("total"), installments: fd.get("installments"), category, subcategory,
          costCenter: fd.get("costCenter"), note: fd.get("note"),
        }, purchaseId || null);
        const files = [...(form.querySelector("[data-attachment-input]")?.files || [])];
        if (files.length) {
          try { await FM.attachments.upload("card_purchase", result.purchaseId, files); }
          catch (error) { FM.ui.toast("A compra foi salva, mas o comprovante não foi enviado. Tente novamente ao editar a compra.", "error"); }
        }
        FM.ui.toast(current ? "Compra atualizada." : "Compra registrada no cartão.");
      },
    });
  }

  function cancelPurchaseForm(purchaseId) {
    const group = st().accounts.filter((account) => account.type === "Cartão de crédito").flatMap((account) => calc().cardPurchases(account.id)).find((items) => items[0].cardPurchaseId === purchaseId);
    if (!group) return;
    FM.ui.modalForm({
      title: "Cancelar compra",
      subtitle: `${esc(purchaseId)} · todas as parcelas serão canceladas`,
      size: "sm",
      submitLabel: "Cancelar compra",
      submitClass: "danger",
      body: `<div class="field"><label>Motivo</label><textarea class="textarea" name="reason" required placeholder="Ex.: estorno da loja"></textarea></div>
        <p class="modal-note mt-8">Se alguma fatura já tiver pagamento, estorne o pagamento antes de cancelar a compra.</p>`,
      async onSubmit(fd) {
        await FM.actions.cancelCardPurchase(purchaseId, fd.get("reason"));
        FM.ui.toast("Compra cancelada. O histórico foi preservado.", "info");
      },
    });
  }

  function payInvoiceForm(cardId, invoiceMonth) {
    const invoice = calc().cardInvoice(cardId, invoiceMonth);
    if (invoice.balance <= 0) return;
    FM.ui.modalForm({
      title: "Pagar fatura",
      subtitle: `${calc().accountName(cardId)} · ${monthLabel(invoiceMonth, "long")}`,
      size: "sm",
      submitLabel: "Registrar pagamento",
      submitIcon: "check",
      body: `<div class="detail-hero">
        <div class="detail-hero-main"><strong>Saldo da fatura</strong><span>Vencimento ${fmtDate(invoice.dueDate)}</span></div>
        <div class="amount neg">${money(invoice.balance)}</div>
      </div>
      <div class="form-grid mt-12">
        <div class="field"><label>Valor</label><div class="money-wrap"><span>R$</span><input class="input money" name="amount" inputmode="decimal" value="${String(invoice.balance).replace(".", ",")}"></div></div>
        <div class="field"><label>Data</label><input class="input" type="date" name="date" value="${todayISO()}"></div>
        <div class="field full"><label>Conta de pagamento</label><select class="select" name="fromAccount">${FM.ui.accountOptions("", false, "excludeCards")}</select></div>
        <div class="field full"><label>Observação</label><input class="input" name="note" value="Pagamento da fatura ${esc(invoiceMonth)}"></div>
      </div>
      ${FM.attachments?.available() ? FM.attachments.inputField() : ""}`,
      async onSubmit(fd, form) {
        await FM.actions.payInvoice(cardId, invoiceMonth, {
          amount: fd.get("amount"), date: fd.get("date"), fromAccount: fd.get("fromAccount"), note: fd.get("note"),
        });
        const files = [...(form.querySelector("[data-attachment-input]")?.files || [])];
        if (files.length) {
          try { await FM.attachments.upload("invoice", `${cardId}:${invoiceMonth}`, files); }
          catch (error) { FM.ui.toast("O pagamento foi salvo, mas o comprovante não foi enviado. Tente novamente em Comprovantes.", "error"); }
        }
        FM.ui.toast("Pagamento da fatura registrado.");
      },
    });
  }

  function invoiceBadge(status) {
    const tone = status === "Paga" ? "ok" : status === "Parcial" ? "warn" : status === "Vencida" ? "danger" : "primary";
    return `<span class="badge ${tone}"><span class="dot"></span>${esc(status)}</span>`;
  }

  FM.views.cartoes = function (ctx, mount) {
    const cards = st().accounts.filter((account) => account.type === "Cartão de crédito");
    const requestedCard = new URLSearchParams((location.hash.split("?")[1] || "")).get("card");
    if (cards.some((card) => card.id === requestedCard)) {
      selectedCardId = requestedCard;
      selectedInvoiceMonth = "";
      history.replaceState(null, "", "#/cartoes");
    }
    if (!cards.some((card) => card.id === selectedCardId)) selectedCardId = cards[0]?.id || "";
    const card = cards.find((item) => item.id === selectedCardId);
    const configuredCards = cards.filter((item) => num(item.limit) > 0);
    const totalLimit = configuredCards.reduce((sum, item) => sum + num(item.limit), 0);
    const totalUsed = configuredCards.reduce((sum, item) => sum + calc().cardSummary(item.id).used, 0);
    const totalAvailable = configuredCards.reduce((sum, item) => sum + calc().cardSummary(item.id).available, 0);
    const configured = configuredCards.length > 0;
    const openInvoices = cards.reduce((sum, item) => sum + calc().cardMonths(item.id).reduce((value, key) => value + calc().cardInvoice(item.id, key).balance, 0), 0);

    if (!card) {
      mount.innerHTML = `<div class="page-enter"><div class="content-head"><div><h2>Cartões e faturas</h2><p>Controle limite, compras parceladas e pagamentos por competência.</p></div></div>
        <div class="card">${FM.ui.emptyState("credit-card", "Nenhum cartão cadastrado", "Cadastre um cartão para registrar compras e acompanhar faturas sem misturar com o saldo disponível.", `<button class="btn primary" id="empty-card">${icon("plus")}Criar cartão</button>`)}</div></div>`;
      mount.querySelector("#empty-card").addEventListener("click", () => cardForm(null));
      return;
    }

    const summary = calc().cardSummary(card.id);
    const months = calc().cardMonths(card.id);
    if (!months.includes(selectedInvoiceMonth)) selectedInvoiceMonth = months.includes(ctx.month) ? ctx.month : months[0];
    const invoice = calc().cardInvoice(card.id, selectedInvoiceMonth);
    const purchases = st().transactions.filter((tx) => !calc().isCancelled(tx) && tx.account === card.id && tx.invoiceMonth === selectedInvoiceMonth);
    const payments = st().transfers.filter((transfer) => transfer.toAccount === card.id && transfer.invoiceMonth === selectedInvoiceMonth);
    const history = calc().cardPurchases(card.id);
    const usage = summary.total > 0 ? Math.min(100, summary.used / summary.total * 100) : 0;

    mount.innerHTML = `<div class="page-enter">
      <div class="content-head"><div><h2>Cartões e faturas</h2><p>Compras, limite e liquidação por mês de fatura.</p></div>
        <div class="content-actions"><button class="btn ghost sm" id="new-card">${icon("plus")}Novo cartão</button><button class="btn primary sm" id="new-purchase">${icon("credit-card")}Nova compra</button></div></div>
      <div class="kpi-grid">
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Limite configurado</span><span class="kpi-icon violet">${icon("credit-card")}</span></div><div class="kpi-value">${configured ? money(totalLimit) : "—"}</div><div class="kpi-foot"><span>${configuredCards.length} cartão(es) com limite</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Limite utilizado</span><span class="kpi-icon amber">${icon("percent")}</span></div><div class="kpi-value">${money(totalUsed)}</div><div class="kpi-foot"><span>Somente cartões com limite configurado</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Limite disponível</span><span class="kpi-icon green">${icon("wallet")}</span></div><div class="kpi-value">${configured ? money(totalAvailable) : "—"}</div><div class="kpi-foot"><span>Somente cartões com limite configurado</span></div></article>
        <article class="kpi"><div class="kpi-head"><span class="kpi-label">Faturas em aberto</span><span class="kpi-icon cyan">${icon("calendar")}</span></div><div class="kpi-value">${money(openInvoices)}</div><div class="kpi-foot"><span>Todos os meses e cartões</span></div></article>
      </div>
      <div class="card-picker mt-16" aria-label="Selecionar cartão">${cards.map((item) => `<button type="button" class="card-picker-item ${item.id === card.id ? "active" : ""}" data-select-card="${esc(item.id)}"><span class="card-chip" style="background:${/^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#7c6a9c"}"></span><span><strong>${esc(item.name)}</strong><small>${esc(item.institution || item.brand || item.type)}</small></span><b>${money(calc().cardSummary(item.id).used)}</b></button>`).join("")}</div>
      <div class="card mt-16"><div class="card-body">
        <div class="content-head"><div><div class="card-title">${icon("credit-card")}${esc(card.name)}</div><div class="card-sub">${esc(card.institution || "")}${card.brand ? " · " + esc(card.brand) : ""} · fecha dia ${card.closingDay} · vence dia ${card.dueDay}</div></div><button class="btn subtle sm" id="edit-card">${icon("edit")}Editar cartão</button></div>
        <div class="limit-row"><div><span>Limite utilizado</span><strong>${money(summary.used)} ${summary.total > 0 ? `de ${money(summary.total)}` : "· limite não configurado"}</strong></div><span>${summary.total > 0 ? FM.utils.pct(usage / 100, 0) : "—"}</span></div>
        <div class="progress-track mt-8"><span style="width:${usage}%"></span></div>
        <div class="small muted mt-8">Disponível: <b>${summary.total > 0 ? money(summary.available) : "sem limite configurado"}</b></div>
      </div></div>
      <div class="card mt-16"><div class="card-head"><div><div class="card-title">${icon("calendar")}Fatura de ${esc(monthLabel(selectedInvoiceMonth, "long"))}</div><div class="card-sub">Fechamento ${fmtDate(invoice.closingDate)} · vencimento ${fmtDate(invoice.dueDate)}</div></div>
        <div class="row"><select class="select compact-select" id="invoice-month" aria-label="Mês da fatura">${months.map((key) => `<option value="${key}" ${key === selectedInvoiceMonth ? "selected" : ""}>${esc(monthLabel(key, "long"))}</option>`).join("")}</select>${FM.attachments?.available() ? `<button class="btn ghost sm" id="invoice-attachments">${icon("file")}Comprovantes</button>` : ""}${invoice.balance > 0 ? `<button class="btn primary sm" id="pay-invoice">${icon("check")}Pagar fatura</button>` : ""}</div></div>
        <div class="invoice-summary"><div><span>Total da fatura</span><strong>${money(invoice.total)}</strong></div><div><span>Pago</span><strong class="text-green">${money(invoice.paid)}</strong></div><div><span>Saldo</span><strong class="${invoice.balance > 0 ? "text-red" : "text-green"}">${money(invoice.balance)}</strong></div><div><span>Situação</span>${invoiceBadge(invoice.status)}</div></div>
        <div class="card-body">
          <div class="subsection-title"><span>Compras desta fatura</span><span class="badge muted">${purchases.length} item(ns)</span></div>
          ${purchases.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Descrição</th><th>Parcela</th><th class="num">Valor</th></tr></thead><tbody>${purchases.map((tx) => `<tr><td class="nowrap">${fmtDate(tx.date)}</td><td><button class="link-btn" data-edit-purchase="${esc(tx.cardPurchaseId)}">${esc(tx.description)}</button><div class="small muted">${esc(tx.category)} › ${esc(tx.subcategory)}</div></td><td>${tx.installmentNumber}/${tx.installmentCount}</td><td class="num amount">${money(tx.amount)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="reminder-empty">${icon("receipt")}Nenhuma compra nesta fatura.</div>`}
          <div class="subsection-title mt-16"><span>Pagamentos</span><span class="badge muted">${payments.length} operação(ões)</span></div>
          ${payments.length ? payments.map((transfer) => `<div class="payment-line"><div><strong>${money(transfer.amount)}</strong><span>${fmtDate(transfer.date)} · ${esc(calc().accountName(transfer.fromAccount))} · ${esc(transfer.id)}</span></div><button class="icon-btn sm danger" data-reverse-payment="${esc(transfer.id)}" title="Estornar pagamento">${icon("refresh")}</button></div>`).join("") : `<div class="reminder-empty">Nenhum pagamento registrado.</div>`}
        </div>
      </div>
      <div class="card mt-16"><div class="card-head"><div><div class="card-title">${icon("receipt")}Histórico de compras</div><div class="card-sub">Todas as compras do cartão, inclusive canceladas</div></div></div>
        <div class="card-body">${history.length ? history.map((items) => {
          const first = items[0];
          const cancelled = items.every(calc().isCancelled);
          return `<div class="purchase-line"><div class="type-mark despesa">${icon("credit-card")}</div><div class="purchase-main"><strong>${esc(first.description.replace(/\s*\(\d+\/\d+\)$/, ""))}</strong><span>${esc(first.cardPurchaseId)} · ${fmtDate(first.purchaseDate || first.date)} · ${first.installmentCount} parcela(s) · ${esc(monthLabel(first.invoiceMonth, "short"))}${first.installmentCount > 1 ? " a " + esc(monthLabel(items[items.length - 1].invoiceMonth, "short")) : ""}</span></div><div class="text-right"><strong>${money(first.purchaseTotal)}</strong><span class="badge ${cancelled ? "muted" : "primary"}">${cancelled ? "Cancelada" : "Registrada"}</span></div><div class="row"><button class="icon-btn sm" data-edit-purchase="${esc(first.cardPurchaseId)}" ${cancelled ? "disabled" : ""} title="Editar compra">${icon("edit")}</button><button class="icon-btn sm danger" data-cancel-purchase="${esc(first.cardPurchaseId)}" ${cancelled ? "disabled" : ""} title="Cancelar compra">${icon("trash")}</button></div></div>`;
        }).join("") : `<div class="reminder-empty">Nenhuma compra registrada neste cartão.</div>`}</div>
      </div>
    </div>`;

    mount.querySelector("#new-card").addEventListener("click", () => cardForm(null));
    mount.querySelector("#new-purchase").addEventListener("click", () => purchaseForm(null, card.id));
    mount.querySelector("#edit-card").addEventListener("click", () => cardForm(card));
    mount.querySelectorAll("[data-select-card]").forEach((button) => button.addEventListener("click", () => {
      selectedCardId = button.dataset.selectCard;
      selectedInvoiceMonth = "";
      FM.app.renderCurrent();
    }));
    mount.querySelector("#invoice-month").addEventListener("change", (event) => {
      selectedInvoiceMonth = event.target.value;
      FM.app.renderCurrent();
    });
    mount.querySelector("#invoice-attachments")?.addEventListener("click", () => FM.attachments.open("invoice", `${card.id}:${selectedInvoiceMonth}`, `Comprovantes · ${esc(monthLabel(selectedInvoiceMonth, "long"))}`));
    mount.querySelector("#pay-invoice")?.addEventListener("click", () => payInvoiceForm(card.id, selectedInvoiceMonth));
    mount.querySelectorAll("[data-edit-purchase]").forEach((button) => button.addEventListener("click", () => purchaseForm(button.dataset.editPurchase, card.id)));
    mount.querySelectorAll("[data-cancel-purchase]").forEach((button) => button.addEventListener("click", () => cancelPurchaseForm(button.dataset.cancelPurchase)));
    mount.querySelectorAll("[data-reverse-payment]").forEach((button) => button.addEventListener("click", async () => {
      const transfer = payments.find((item) => item.id === button.dataset.reversePayment);
      const ok = await FM.ui.confirm({ title: "Estornar pagamento", message: `O pagamento de ${money(transfer.amount)} será removido e o saldo da fatura voltará a ficar em aberto.`, confirmLabel: "Estornar", danger: true });
      if (!ok) return;
      try {
        await FM.actions.reverseInvoicePayment(transfer.id);
        FM.ui.toast("Pagamento estornado.", "info");
      } catch (error) { FM.ui.toast(error.message, "error"); }
    }));
  };

  FM.ui.openCardPurchaseForm = (purchaseId, cardId) => purchaseForm(purchaseId, cardId);
})();

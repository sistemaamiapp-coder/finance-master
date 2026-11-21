/* =========================================================
   FINANCE MASTER — componentes de interface
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM || (window.FM = {});
  const U = FM.utils;
  const { esc, money, fmtDate, todayISO } = U;
  const state = () => FM.store.state;

  const icon = (name, cls) => `<svg class="icon${cls ? " " + cls : ""}"><use href="#i-${name}"></use></svg>`;

  /* ---------------- toast ---------------- */
  function toast(message, type, title) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const t = type || "success";
    const icons = { success: "check-circle", error: "alert", warn: "alert", info: "info" };
    const titles = { success: "Tudo certo", error: "Não foi possível", warn: "Atenção", info: "Informação" };
    const el = document.createElement("div");
    el.className = `toast ${t}`;
    el.innerHTML = `<div class="toast-icon">${icon(icons[t] || "info")}</div>
      <div class="toast-body"><strong>${esc(title || message)}</strong>${title ? `<span>${esc(message)}</span>` : ""}</div>
      <button class="toast-close" aria-label="Fechar">${icon("x")}</button>`;
    root.appendChild(el);
    const remove = () => {
      if (!el.isConnected) return;
      el.classList.add("out");
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector(".toast-close").addEventListener("click", remove);
    const timer = setTimeout(remove, 4600);
    el.addEventListener("mouseenter", () => clearTimeout(timer));
  }

  /* ---------------- modal base ---------------- */
  function shell(inner) {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = inner;
    root.appendChild(ov);
    document.body.classList.add("no-scroll");
    const close = () => {
      ov.remove();
      document.body.classList.remove("no-scroll");
    };
    ov.addEventListener("click", (e) => {
      if (e.target === ov) close();
    });
    ov.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    return { ov, close };
  }

  function modal(o) {
    const size = o.size ? ` ${o.size}` : "";
    const html = `<div class="modal${size}" role="dialog" aria-modal="true" aria-label="${esc(o.title || "Janela")}">
      <div class="modal-head">
        <div class="modal-head-text"><h3>${esc(o.title || "")}</h3>${o.subtitle ? `<p>${esc(o.subtitle)}</p>` : ""}</div>
        <button type="button" class="icon-btn sm modal-close" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      ${o.body != null ? `<div class="modal-body">${o.body}</div>` : ""}
      ${o.footer ? `<div class="modal-foot">${o.footer}</div>` : ""}
    </div>`;
    const { ov, close } = shell(html);
    ov.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    if (o.onMount) o.onMount(ov, close);
    return { ov, close };
  }

  function modalForm(o) {
    const size = o.size ? ` ${o.size}` : "";
    const html = `<div class="modal${size}" role="dialog" aria-modal="true" aria-label="${esc(o.title || "Formulário")}">
      <div class="modal-head">
        <div class="modal-head-text"><h3>${esc(o.title || "")}</h3>${o.subtitle ? `<p>${esc(o.subtitle)}</p>` : ""}</div>
        <button type="button" class="icon-btn sm modal-close" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <form novalidate>
        <div class="modal-body">${o.body || ""}</div>
        <div class="modal-foot">
          ${o.footerLeft ? `<div class="foot-start">${o.footerLeft}</div>` : ""}
          <button type="button" class="btn ghost" data-close>${esc(o.cancelLabel || "Cancelar")}</button>
          <button type="submit" class="btn ${o.submitClass || "primary"}">${o.submitIcon ? icon(o.submitIcon) : ""}${esc(o.submitLabel || "Salvar")}</button>
        </div>
      </form>
    </div>`;
    const { ov, close } = shell(html);
    const form = ov.querySelector("form");
    const submitBtn = form.querySelector('button[type="submit"]');
    let sending = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sending) return;
      sending = true;
      submitBtn.disabled = true;
      try {
        const result = await o.onSubmit(new FormData(form), form, ov);
        if (result !== false) {
          close();
          if (o.onSaved) o.onSaved(result);
        }
      } catch (err) {
        toast(err && err.message ? err.message : "Não foi possível salvar.", "error");
      } finally {
        sending = false;
        submitBtn.disabled = false;
      }
    });
    if (o.onMount) o.onMount(ov, close, form);
    setTimeout(() => {
      const first = form.querySelector("input:not([type=hidden]):not([disabled]), select, textarea");
      if (first) first.focus();
    }, 60);
    return { ov, close, form };
  }

  function confirm(o) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      const m = modal({
        title: o.title || "Confirmar ação",
        subtitle: o.subtitle || "",
        size: "sm",
        body: `<p style="font-size:12.5px;color:var(--text-2);line-height:1.6">${o.message || ""}</p>`,
        footer: `<button type="button" class="btn ghost" data-close>${esc(o.cancelLabel || "Voltar")}</button>
          <button type="button" class="btn ${o.danger ? "danger" : "primary"}" data-confirm>${esc(o.confirmLabel || "Confirmar")}</button>`,
        onMount(ov, close) {
          ov.querySelector("[data-confirm]").addEventListener("click", () => {
            done(true);
            close();
          });
          ov.querySelectorAll("[data-close]").forEach((b) =>
            b.addEventListener("click", () => done(false))
          );
          ov.addEventListener("click", (e) => {
            if (e.target === ov) done(false);
          });
        },
      });
      const obs = new MutationObserver(() => {
        if (!m.ov.isConnected) {
          obs.disconnect();
          done(false);
        }
      });
      obs.observe(document.getElementById("modal-root"), { childList: true });
    });
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
    document.body.classList.remove("no-scroll");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const ov = document.querySelector(".modal-overlay");
      if (ov) {
        ov.remove();
        document.body.classList.remove("no-scroll");
      }
    }
  });

  /* ---------------- tooltip ---------------- */
  (function bindTips() {
    if (FM._tipsBound) return;
    FM._tipsBound = true;
    const tip = document.getElementById("chart-tip");
    if (!tip) return;
    let hideTimer = null;
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t) return;
      clearTimeout(hideTimer);
      tip.innerHTML = t.getAttribute("data-tip");
      tip.hidden = false;
      tip.classList.add("show");
    });
    document.addEventListener("pointerout", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t) return;
      tip.classList.remove("show");
      hideTimer = setTimeout(() => { tip.hidden = true; }, 100);
    });
    document.addEventListener("pointermove", (e) => {
      if (!tip.classList.contains("show")) return;
      tip.style.left = `${e.clientX}px`;
      tip.style.top = `${e.clientY}px`;
    });
  })();

  /* ---------------- small render helpers ---------------- */
  function statusBadge(txOrStatus) {
    const s = typeof txOrStatus === "string" ? txOrStatus : FM.calc.effectiveStatus(txOrStatus);
    return `<span class="badge ${FM.calc.statusTone(s)}"><span class="dot"></span>${esc(s)}</span>`;
  }
  function typeMark(type) {
    const kind = type === "receita" ? "receita" : type === "transferencia" ? "transfer" : "despesa";
    const ic = kind === "receita" ? "arrow-up" : kind === "transfer" ? "transfer" : "arrow-down";
    return `<span class="type-mark ${kind}">${icon(ic)}</span>`;
  }
  function emptyState(iconName, title, text, actionHTML) {
    return `<div class="empty-state"><div class="empty-icon">${icon(iconName || "info")}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHTML || ""}</div>`;
  }
  function accountOptions(selected, includeInactive) {
    const accs = state().accounts.filter((a) => includeInactive || a.active || a.id === selected);
    if (!accs.length) return `<option value="">Cadastre uma conta primeiro</option>`;
    return accs.map((a) => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}${a.institution ? " — " + esc(a.institution) : ""}${a.active ? "" : " (inativa)"}</option>`).join("");
  }
  function costCenterOptions(selected) {
    const list = state().costCenters;
    return `<option value="">Sem centro de custo</option>` + list.map((c) => `<option value="${esc(c.name)}" ${c.name === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  }
  function categoryOptions(type, selectedCat, selectedSub) {
    const typeName = type === "receita" ? "Receita" : "Despesa";
    const list = state().categories.filter((c) => c.type === typeName);
    if (!list.length) return `<option value="">Nenhuma categoria de ${typeName.toLowerCase()} cadastrada</option>`;
    const groups = {};
    list.forEach((c) => {
      (groups[c.name] = groups[c.name] || []).push(c);
    });
    let out = `<option value="">Selecione...</option>`;
    Object.keys(groups).forEach((name) => {
      out += `<optgroup label="${esc(name)}">`;
      groups[name].forEach((c) => {
        const val = `${c.name}||${c.subcategory}`;
        const sel = c.name === selectedCat && c.subcategory === selectedSub;
        out += `<option value="${esc(val)}" ${sel ? "selected" : ""}>${esc(c.name)} › ${esc(c.subcategory)}</option>`;
      });
      out += `</optgroup>`;
    });
    return out;
  }
  function methodOptions(selected) {
    return (state().settings.methods || []).map((m) => `<option ${m === selected ? "selected" : ""}>${esc(m)}</option>`).join("");
  }

  /* ---------------- transaction form ---------------- */
  function openTxForm(tx, opts) {
    opts = opts || {};
    const isEdit = !!tx;
    const type = tx ? tx.type : opts.type || "despesa";
    const hasPayments = tx && (tx.payments || []).length > 0;
    const status = tx ? FM.calc.effectiveStatus(tx) : "";
    const body = `
      <div class="form-grid">
        <div class="field full">
          <label>Descrição</label>
          <input class="input" name="description" maxlength="140" placeholder="Ex.: Serviço prestado, aluguel, compra de materiais..." value="${tx ? esc(tx.description) : ""}">
        </div>
        <div class="field">
          <label>Tipo</label>
          <div class="segmented" data-type-seg>
            <button type="button" data-type="receita" class="${type === "receita" ? "active" : ""}">Receita</button>
            <button type="button" data-type="despesa" class="${type === "despesa" ? "active" : ""}">Despesa</button>
            <input type="hidden" name="type" value="${type}">
          </div>
          ${hasPayments ? `<span class="hint">Tipo bloqueado: o título já possui baixas.</span>` : ""}
        </div>
        <div class="field">
          <label>Valor</label>
          <div class="money-wrap"><span>R$</span><input class="input money" name="amount" inputmode="decimal" placeholder="0,00" value="${tx ? String(tx.amount).replace(".", ",") : ""}"></div>
        </div>
        <div class="field">
          <label>Data do lançamento</label>
          <input type="date" class="input" name="date" value="${tx ? tx.date : opts.date || todayISO()}">
        </div>
        <div class="field">
          <label>Vencimento</label>
          <input type="date" class="input" name="dueDate" value="${tx ? tx.dueDate : opts.date || todayISO()}">
        </div>
        <div class="field">
          <label>Categoria</label>
          <select class="select" name="category" data-cat-select>${categoryOptions(type, tx ? tx.category : "", tx ? tx.subcategory : "")}</select>
        </div>
        <div class="field">
          <label>Conta financeira</label>
          <select class="select" name="account">${accountOptions(tx ? tx.account : (opts.account || ""))}</select>
        </div>
        <div class="field">
          <label>Centro de custo</label>
          <select class="select" name="costCenter">${costCenterOptions(tx ? tx.costCenter : opts.costCenter || "")}</select>
        </div>
        <div class="field">
          <label>Forma de pagamento</label>
          <select class="select" name="method">${methodOptions(tx ? tx.method : "PIX")}</select>
        </div>
        <div class="field full">
          <label>Comprovante / observação</label>
          <input class="input" name="note" maxlength="180" placeholder="Nº do recibo, fornecedor, observações..." value="${tx ? esc(tx.note) : ""}">
        </div>
        ${!isEdit ? `<div class="form-section full">
          <label class="check"><input type="checkbox" name="settleNow"> Já registrar a baixa (dinheiro movimentado)</label>
          <div class="form-grid mt-8" data-settle-fields hidden>
            <div class="field"><label>Data da baixa</label><input type="date" class="input" name="settleDate" value="${todayISO()}"></div>
            <div class="field"><span class="hint">Se desmarcado, o lançamento fica em aberto (previsto) e pode ser baixado depois, inclusive parcialmente.</span></div>
          </div>
        </div>` : ""}
      </div>
      ${!state().categories.some((c) => c.type === (type === "receita" ? "Receita" : "Despesa")) ? `<div class="analytics-callout mt-12">${icon("info")}<span>Não existem categorias deste tipo. Cadastre em <b>Categorias</b> antes de lançar.</span></div>` : ""}
    `;

    modalForm({
      title: isEdit ? "Editar lançamento" : "Novo lançamento",
      subtitle: isEdit ? `${tx.id} · ${status}` : "Registre cada operação uma única vez na base central.",
      body,
      size: "lg",
      submitLabel: isEdit ? "Salvar alterações" : "Registrar lançamento",
      submitIcon: "check",
      footerLeft: isEdit ? `<span class="modal-note">Baixa: ${money(FM.calc.paidTotal(tx))} de ${money(tx.amount)}</span>` : `<span class="modal-note">Status é calculado automaticamente.</span>`,
      onMount(ov, close, form) {
        const seg = ov.querySelector("[data-type-seg]");
        const catSel = ov.querySelector("[data-cat-select]");
        const hidden = form.querySelector('input[name="type"]');
        const settleCheck = form.querySelector('input[name="settleNow"]');
        const settleFields = form.querySelector("[data-settle-fields]");
        const dateInput = form.querySelector('input[name="date"]');
        const dueInput = form.querySelector('input[name="dueDate"]');
        if (hasPayments) seg.querySelectorAll("button").forEach((b) => (b.disabled = true));
        seg.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (hasPayments) return;
            const t = btn.dataset.type;
            hidden.value = t;
            seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
            const prev = catSel.value.split("||");
            catSel.innerHTML = categoryOptions(t, prev[0], prev[1]);
          });
        });
        if (dateInput && dueInput) {
          dateInput.addEventListener("change", () => {
            if (!dueInput.value || dueInput.value === dateInput.defaultValue) dueInput.value = dateInput.value;
            dateInput.defaultValue = dateInput.value;
          });
        }
        if (settleCheck && settleFields) {
          settleCheck.addEventListener("change", () => {
            settleFields.hidden = !settleCheck.checked;
            if (settleCheck.checked) {
              const acc = form.querySelector('select[name="account"]');
              if (acc && !acc.value) acc.focus();
            }
          });
        }
      },
      onSubmit(fd) {
        const typeVal = fd.get("type") === "receita" ? "receita" : "despesa";
        const catVal = String(fd.get("category") || "");
        const parts = catVal.split("||");
        if (!parts[0] || !parts[1]) throw new Error("Selecione uma categoria.");
        const payload = {
          type: typeVal,
          description: fd.get("description"),
          amount: fd.get("amount"),
          date: fd.get("date"),
          dueDate: fd.get("dueDate") || fd.get("date"),
          category: parts[0],
          subcategory: parts[1],
          account: fd.get("account"),
          costCenter: fd.get("costCenter"),
          method: fd.get("method"),
          note: fd.get("note"),
          settleNow: !!fd.get("settleNow"),
          settleDate: fd.get("settleDate"),
        };
        const saved = FM.actions.saveTransaction(payload, isEdit ? tx.id : null);
        toast(isEdit ? "Lançamento atualizado com sucesso." : "Lançamento registrado com sucesso.");
        return saved;
      },
      onSaved(saved) {
        if (opts.onSaved) opts.onSaved(saved);
      },
    });
  }

  /* ---------------- payment (baixa) ---------------- */
  function openPaymentForm(txId, opts) {
    opts = opts || {};
    const tx = FM.calc.txById(txId);
    if (!tx) return toast("Lançamento não encontrado.", "error");
    const remaining = FM.calc.remaining(tx);
    const isReceita = tx.type === "receita";
    const body = `
      <div class="detail-hero">
        ${typeMark(tx.type)}
        <div class="detail-hero-main"><strong>${esc(tx.description)}</strong><span>${esc(tx.category)} › ${esc(tx.subcategory)} · vence ${fmtDate(tx.dueDate)}</span></div>
        <div class="text-right"><div class="small muted">Em aberto</div><div class="amount ${isReceita ? "pos" : "neg"}">${money(remaining)}</div></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Valor da baixa</label><div class="money-wrap"><span>R$</span><input class="input money" name="amount" inputmode="decimal" value="${String(remaining).replace(".", ",")}"></div></div>
        <div class="field"><label>Data</label><input type="date" class="input" name="date" value="${todayISO()}"></div>
        <div class="field full"><label>Conta ${isReceita ? "de entrada" : "de saída"}</label><select class="select" name="account">${accountOptions(tx.account)}</select></div>
        <div class="field full"><label>Observação</label><input class="input" name="note" placeholder="Opcional"></div>
      </div>
    `;
    modalForm({
      title: isReceita ? "Registrar recebimento" : "Registrar pagamento",
      subtitle: `${tx.id} · pagamentos parciais são permitidos`,
      body,
      submitLabel: isReceita ? "Registrar recebimento" : "Registrar pagamento",
      submitIcon: "check",
      footerLeft: `<span class="modal-note">Valor total: ${money(tx.amount)} · já baixado: ${money(FM.calc.paidTotal(tx))}</span>`,
      onSubmit(fd) {
        const saved = FM.actions.registerPayment(tx.id, {
          amount: fd.get("amount"),
          date: fd.get("date"),
          account: fd.get("account"),
          note: fd.get("note"),
        });
        toast("Baixa registrada com sucesso.");
        return saved;
      },
      onSaved(saved) {
        if (opts.onSaved) opts.onSaved(saved);
      },
    });
  }

  function askCancelTx(tx) {
    modalForm({
      title: "Cancelar lançamento",
      subtitle: `${tx.id} · o histórico será preservado`,
      body: `<div class="field"><label>Motivo do cancelamento</label><textarea class="textarea" name="reason" placeholder="Explique o motivo (obrigatório)"></textarea></div>
        <p class="modal-note mt-8">O lançamento não será apagado: ficará marcado como cancelado, com data, motivo e trilha de auditoria.</p>`,
      submitLabel: "Cancelar lançamento",
      submitClass: "danger",
      onSubmit(fd) {
        FM.actions.cancelTransaction(tx.id, fd.get("reason"));
        toast("Lançamento cancelado. O registro foi preservado.", "info");
      },
    });
  }

  /* ---------------- transaction detail ---------------- */
  function openTxDetail(txId, opts) {
    opts = opts || {};
    const tx = FM.calc.txById(txId);
    if (!tx) return toast("Lançamento não encontrado.", "error");
    const status = FM.calc.effectiveStatus(tx);
    const paid = FM.calc.paidTotal(tx);
    const remaining = FM.calc.remaining(tx);
    const isCancelled = FM.calc.isCancelled(tx);
    const payments = FM.calc.payments(tx);
    const history = FM.calc.auditFor(tx.id);

    const payRows = payments.length
      ? payments.map((p) => `<div class="payment-line">
          <span class="pay-date">${fmtDate(p.date)}</span>
          <span class="pay-account">${esc(FM.calc.accountName(p.account || tx.account))}${p.note ? " · " + esc(p.note) : ""}</span>
          <span class="amount ${tx.type === "receita" ? "pos" : "neg"}">${money(p.amount)}</span>
          ${!isCancelled ? `<button class="icon-btn sm danger" data-reverse="${esc(p.id)}" title="Estornar baixa">${icon("refresh")}</button>` : ""}
        </div>`).join("")
      : `<p class="small muted">Nenhuma baixa registrada. O título está em aberto.</p>`;

    const historyRows = history.length
      ? history.map((h) => `<div class="history-item"><time>${esc(U.fmtDateTime(h.ts))}</time><div><strong>${esc(h.action)}</strong>${h.detail ? ` — ${esc(h.detail)}` : ""}</div></div>`).join("")
      : `<p class="small muted">Sem eventos registrados.</p>`;

    const body = `
      <div class="detail-hero">
        ${typeMark(tx.type)}
        <div class="detail-hero-main">
          <strong>${esc(tx.description)}</strong>
          <span>${esc(tx.category)} › ${esc(tx.subcategory)} · ${tx.id}</span>
        </div>
        <div class="text-right">
          ${statusBadge(status)}
          <div class="amount ${tx.type === "receita" ? "pos" : "neg"}" style="margin-top:6px">${money(tx.amount)}</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><span>Data do lançamento</span><strong>${fmtDate(tx.date)}</strong></div>
        <div class="info-item"><span>Vencimento</span><strong>${fmtDate(tx.dueDate)} ${!isCancelled && remaining > 0 && tx.dueDate < todayISO() ? `<span class="badge danger" style="margin-left:6px">${U.dayDiff(tx.dueDate) * -1}d em atraso</span>` : ""}</strong></div>
        <div class="info-item"><span>Conta</span><strong>${esc(FM.calc.accountName(tx.account))}</strong></div>
        <div class="info-item"><span>Centro de custo</span><strong>${esc(tx.costCenter || "—")}</strong></div>
        <div class="info-item"><span>Forma</span><strong>${esc(tx.method || "—")}</strong></div>
        <div class="info-item"><span>Comprovante / obs.</span><strong>${esc(tx.note || "—")}</strong></div>
        <div class="info-item"><span>Baixado</span><strong class="text-green">${money(paid)}</strong></div>
        <div class="info-item"><span>Em aberto</span><strong class="${remaining > 0 ? "text-amber" : ""}">${money(remaining)}</strong></div>
      </div>
      ${isCancelled && tx.cancelReason ? `<div class="alert-strip danger" style="margin:16px 0 0"><div class="alert-icon">${icon("alert")}</div><div class="alert-text"><strong>Cancelado em ${fmtDate((tx.cancelledAt || "").slice(0, 10))}</strong><span>Motivo: ${esc(tx.cancelReason)}</span></div></div>` : ""}
      <div class="subsection-title">Baixas <span class="muted">${money(paid)} de ${money(tx.amount)}</span></div>
      <div>${payRows}</div>
      <div class="subsection-title">Trilha de auditoria</div>
      <div>${historyRows}</div>
    `;

    const footer = `
      ${!isCancelled ? `<button class="btn danger ghost foot-start" id="tx-cancel">${icon("x")}Cancelar</button>` : `<span class="foot-start"></span>`}
      <button class="btn ghost" data-close>Fechar</button>
      ${!isCancelled ? `<button class="btn" id="tx-edit">${icon("edit")}Editar</button>` : ""}
      ${!isCancelled && remaining > 0.004 ? `<button class="btn primary" id="tx-pay">${icon("check")}${tx.type === "receita" ? "Receber" : "Pagar"}</button>` : ""}
    `;

    modal({
      title: "Detalhes do lançamento",
      subtitle: status === "Cancelado" ? "Registro cancelado e preservado" : "Baixas, histórico e auditoria",
      body,
      footer,
      size: "lg",
      onMount(ov, close) {
        const payBtn = ov.querySelector("#tx-pay");
        if (payBtn) payBtn.addEventListener("click", () => openPaymentForm(tx.id, { onSaved: () => openTxDetail(tx.id) }));
        const editBtn = ov.querySelector("#tx-edit");
        if (editBtn) editBtn.addEventListener("click", () => openTxForm(FM.calc.txById(tx.id), { onSaved: () => openTxDetail(tx.id) }));
        const cancelBtn = ov.querySelector("#tx-cancel");
        if (cancelBtn) cancelBtn.addEventListener("click", () => askCancelTx(tx));
        ov.querySelectorAll("[data-reverse]").forEach((b) => {
          b.addEventListener("click", async () => {
            const ok = await confirm({
              title: "Estornar baixa",
              message: "A baixa será removida e o título voltará ao saldo em aberto. A operação fica registrada na auditoria.",
              confirmLabel: "Estornar",
              danger: true,
            });
            if (!ok) return;
            try {
              FM.actions.reversePayment(tx.id, b.dataset.reverse);
              toast("Baixa estornada.", "info");
              openTxDetail(tx.id);
            } catch (err) {
              toast(err.message, "error");
            }
          });
        });
      },
    });
  }

  FM.ui = {
    icon, toast, modal, modalForm, confirm, closeModal,
    statusBadge, typeMark, emptyState, accountOptions, costCenterOptions, categoryOptions, methodOptions,
    openTxForm, openPaymentForm, openTxDetail, askCancelTx,
  };
})();

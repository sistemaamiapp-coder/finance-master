(function () {
  "use strict";
  const FM = window.FM;
  const { esc, money, fmtDate, todayISO, num } = FM.utils;
  const icon = FM.ui.icon;
  const STATUS = { active: "Ativa", paused: "Pausada", ended: "Encerrada" };
  const FREQUENCY = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", annual: "Anual", custom: "Personalizada" };

  function run(promise) {
    return Promise.resolve(promise).then(() => true).catch((error) => {
      FM.ui.toast(error.message || "Não foi possível concluir a operação.", "error");
      return false;
    });
  }

  function accountOptions(selected) {
    return FM.store.state.accounts.filter((account) => account.active || account.id === selected)
      .map((account) => `<option value="${esc(account.id)}" ${account.id === selected ? "selected" : ""}>${esc(account.name)}${account.active ? "" : " (inativa)"}</option>`).join("");
  }

  function frequencyLabel(rule) {
    return rule.frequency === "custom" ? `A cada ${num(rule.intervalDays)} dia(s)` : FREQUENCY[rule.frequency] || "Mensal";
  }

  function openRuleForm(rule) {
    const editing = !!rule;
    const type = rule?.type || "despesa";
    const status = rule?.status || "active";
    const section = rule?.section || (type === "receita" ? "Entradas" : "Contas fixas");
    FM.ui.modalForm({
      title: editing ? "Editar recorrência" : "Nova recorrência",
      subtitle: "As ocorrências futuras serão criadas como previsões, sem baixa automática no caixa.",
      size: "lg",
      submitLabel: editing ? "Salvar recorrência" : "Criar recorrência",
      submitIcon: "check",
      body: `<div class="form-grid">
        <div class="field full"><label for="recurring-description">Descrição</label><input class="input" id="recurring-description" name="description" maxlength="140" value="${esc(rule?.description || "")}" placeholder="Ex.: Aluguel, salário ou assinatura"></div>
        <div class="field"><label for="recurring-type">Tipo</label><select class="select" id="recurring-type" name="type"><option value="despesa" ${type === "despesa" ? "selected" : ""}>Despesa</option><option value="receita" ${type === "receita" ? "selected" : ""}>Receita</option></select></div>
        <div class="field"><label for="recurring-amount">Valor por ocorrência</label><div class="money-wrap"><span>R$</span><input class="input money" id="recurring-amount" name="amount" inputmode="decimal" value="${String(rule?.amount || "").replace(".", ",")}"></div></div>
        <div class="field"><label for="recurring-frequency">Frequência</label><select class="select" id="recurring-frequency" name="frequency">${Object.entries(FREQUENCY).map(([value, label]) => `<option value="${value}" ${(rule?.frequency || "monthly") === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field" id="recurring-interval-field" ${rule?.frequency === "custom" ? "" : "hidden"}><label for="recurring-interval">Intervalo em dias</label><input class="input" id="recurring-interval" name="intervalDays" type="number" min="1" max="3660" step="1" value="${esc(rule?.intervalDays || 30)}"></div>
        <div class="field"><label for="recurring-start">Data inicial</label><input class="input" type="date" id="recurring-start" name="startDate" value="${esc(rule?.startDate || todayISO())}" required></div>
        <div class="field"><label for="recurring-end">Data final</label><input class="input" type="date" id="recurring-end" name="endDate" value="${esc(rule?.endDate || "")}"><span class="field-hint">Opcional. A regra para após esta data.</span></div>
        <div class="field"><label for="recurring-category">Categoria</label><select class="select" id="recurring-category" name="category">${FM.ui.categoryOptions(type, rule?.category || "", rule?.subcategory || "")}</select></div>
        <div class="field" id="recurring-donor-field" ${type === "receita" ? "" : "hidden"}><label for="recurring-donor">Ofertante (opcional)</label><select class="select" id="recurring-donor" name="donorId">${FM.ui.donorOptions(rule?.donorId || "")}</select></div>
        <div class="field"><label for="recurring-account">Conta ou cartão</label><select class="select" id="recurring-account" name="account">${accountOptions(rule?.account || "")}</select></div>
        <div class="field"><label for="recurring-section">Origem</label><select class="select" id="recurring-section" name="section">${FM.store.state.settings.sections.map((value) => `<option value="${esc(value)}" ${value === section ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>
        <div class="field"><label for="recurring-method">Forma de pagamento</label><select class="select" id="recurring-method" name="method">${FM.ui.methodOptions(rule?.method || "PIX")}</select></div>
        <div class="field"><label for="recurring-cost-center">Centro de custo</label><select class="select" id="recurring-cost-center" name="costCenter">${FM.ui.costCenterOptions(rule?.costCenter || "")}</select></div>
        <div class="field"><label for="recurring-status">Status</label><select class="select" id="recurring-status" name="status" ${status === "ended" ? "disabled" : ""}>${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field full"><label class="check-line"><input type="checkbox" name="reviewBeforeGenerate" ${rule?.reviewBeforeGenerate ? "checked" : ""}><span>Exigir revisão e seleção das ocorrências antes de gerar</span></label></div>
        <div class="field full"><label for="recurring-note">Observação</label><textarea class="textarea" id="recurring-note" name="note" maxlength="400" placeholder="Detalhes que serão copiados para as ocorrências futuras">${esc(rule?.note || "")}</textarea></div>
      </div>
      ${editing && rule.occurrenceKeys?.length ? `<div class="analytics-callout mt-12">${icon("info")}<span>Esta regra já gerou ${rule.occurrenceKeys.length} ocorrência(s). Editar a regra não altera os lançamentos antigos.</span></div>` : ""}`,
      onMount: (ov) => {
        const typeField = ov.querySelector("#recurring-type");
        const categoryField = ov.querySelector("#recurring-category");
        const frequencyField = ov.querySelector("#recurring-frequency");
        const intervalField = ov.querySelector("#recurring-interval-field");
        const accountField = ov.querySelector("#recurring-account");
        const sectionField = ov.querySelector("#recurring-section");
        const donorField = ov.querySelector("#recurring-donor-field");
        const updateType = () => {
          categoryField.innerHTML = FM.ui.categoryOptions(typeField.value, rule?.category || "", rule?.subcategory || "");
          if (typeField.value === "receita" && sectionField.value !== "Entradas") sectionField.value = "Entradas";
          if (typeField.value === "despesa" && sectionField.value === "Entradas") sectionField.value = "Contas fixas";
          donorField.hidden = typeField.value !== "receita";
        };
        typeField.addEventListener("change", updateType);
        frequencyField.addEventListener("change", () => { intervalField.hidden = frequencyField.value !== "custom"; });
        accountField.addEventListener("change", () => {
          const account = FM.store.state.accounts.find((item) => item.id === accountField.value);
          if (account?.type === "Cartão de crédito" && typeField.value === "despesa") sectionField.value = "Cartão de crédito";
          else if (sectionField.value === "Cartão de crédito") sectionField.value = typeField.value === "receita" ? "Entradas" : "Contas fixas";
        });
      },
      onSubmit: (data) => {
        const [category, subcategory] = String(data.get("category") || "").split("||");
        return FM.actions.saveRecurring({
          description: data.get("description"), type: data.get("type"), amount: data.get("amount"),
          frequency: data.get("frequency"), intervalDays: data.get("intervalDays"),
          startDate: rule?.startDate || data.get("startDate"), endDate: data.get("endDate"),
          category, subcategory, account: data.get("account"), section: data.get("section"),
          method: data.get("method"), costCenter: data.get("costCenter"),
          status: data.get("status") || rule?.status || "active",
          reviewBeforeGenerate: data.get("reviewBeforeGenerate") === "on", note: data.get("note"),
          donorId: data.get("type") === "receita" ? data.get("donorId") : "",
        }, rule?.id);
      },
    });
  }

  function openGenerateForm(rule) {
    const review = rule.reviewBeforeGenerate === true;
    let currentItems = [];
    let reviewed = false;
    FM.ui.modalForm({
      title: "Gerar ocorrências",
      subtitle: `${rule.description} · ${frequencyLabel(rule)}`,
      submitLabel: "Gerar ocorrências",
      submitIcon: "repeat",
      body: `<div class="form-grid">
        <div class="field full"><label for="generate-through">Gerar pendências até</label><input class="input" type="date" id="generate-through" name="through" value="${todayISO()}" required><span class="field-hint">A data limite pode incluir previsões futuras.</span></div>
      </div>
      <div class="subsection-title"><span>Ocorrências pendentes</span><button type="button" class="btn sm ghost" data-recurring-reload>${icon("refresh")}Atualizar</button></div>
      <div id="recurring-occurrences" class="occurrence-list"><div class="reminder-empty">Carregando ocorrências...</div></div>
      ${review ? `<div class="analytics-callout mt-12">${icon("info")}<span>Esta regra exige revisão. Marque explicitamente as ocorrências que deseja gerar.</span></div>` : `<div class="analytics-callout mt-12">${icon("info")}<span>Todas as pendências serão criadas como lançamentos com status Previsto. Nenhuma baixa será registrada automaticamente.</span></div>`}`,
      onMount: (ov) => {
        const through = ov.querySelector("#generate-through");
        const results = ov.querySelector("#recurring-occurrences");
        const submit = ov.querySelector('button[type="submit"]');
        const reload = ov.querySelector("[data-recurring-reload]");
        let request = 0;
        const updateSubmit = () => {
          const selected = results.querySelectorAll('[name="occurrence"]:checked').length;
          submit.disabled = !currentItems.length || (review && (!reviewed || !selected));
          submit.innerHTML = `${icon("repeat")}${currentItems.length ? review ? `Gerar ${selected || "selecionadas"}` : `Gerar ${currentItems.length} ocorrência(s)` : "Nada pendente"}`;
        };
        const load = async () => {
          const token = ++request;
          currentItems = [];
          reviewed = false;
          results.innerHTML = `<div class="reminder-empty">Carregando ocorrências...</div>`;
          submit.disabled = true;
          reload.disabled = true;
          try {
            const items = await FM.actions.previewRecurring(rule.id, through.value);
            if (token !== request || !ov.isConnected) return;
            currentItems = items;
            reviewed = !review;
            results.innerHTML = items.length ? items.map((item) => `<label class="occurrence-row"><input type="checkbox" name="occurrence" value="${esc(item.key)}" ${review ? "" : "checked disabled"}><span class="occurrence-date">${esc(fmtDate(item.date))}</span><strong>${money(rule.amount)}</strong><span class="badge muted">Previsto</span></label>`).join("") : `<div class="reminder-empty">${icon("check-circle")}Nenhuma ocorrência pendente até esta data.</div>`;
            results.querySelectorAll('[name="occurrence"]').forEach((input) => input.addEventListener("change", () => { reviewed = true; updateSubmit(); }));
            updateSubmit();
          } catch (error) {
            if (token !== request || !ov.isConnected) return;
            results.innerHTML = `<div class="reminder-empty text-red">${esc(error.message || "Não foi possível carregar as ocorrências.")}</div>`;
          } finally {
            if (token === request && ov.isConnected) reload.disabled = false;
          }
        };
        reload.addEventListener("click", load);
        through.addEventListener("change", load);
        load();
      },
      onSubmit: async (data) => {
        if (!data.get("through")) throw new Error("Informe a data limite.");
        if (review) {
          const selected = data.getAll("occurrence");
          if (!reviewed || !selected.length) throw new Error("Revise e selecione ao menos uma ocorrência.");
          await FM.actions.generateRecurring(rule.id, data.get("through"), selected);
        } else {
          await FM.actions.generateRecurring(rule.id, data.get("through"));
        }
        FM.ui.toast("Ocorrências geradas como previsões.", "success");
        return true;
      },
    });
  }

  function ruleCard(rule) {
    const generated = rule.occurrenceKeys?.length || 0;
    const next = rule.nextOccurrence;
    return `<article class="card recurring-card">
      <div class="card-head">
        <div><div class="card-title">${icon(rule.type === "receita" ? "arrow-up" : "repeat")}${esc(rule.description)}</div><p class="small muted mt-4">${esc(frequencyLabel(rule))} · ${esc(FM.calc.accountName(rule.account))}</p></div>
        <span class="badge ${rule.status === "active" ? "success" : rule.status === "paused" ? "amber" : "muted"}">${STATUS[rule.status] || "Ativa"}</span>
      </div>
      <div class="card-body">
        <div class="recurring-amount"><span>Valor por ocorrência</span><strong class="${rule.type === "receita" ? "text-green" : ""}">${money(rule.amount)}</strong></div>
        <div class="recurring-facts">
          <div><span>Próxima ocorrência</span><strong class="${rule.status === "active" && next && next <= todayISO() ? "text-amber" : ""}">${next ? esc(fmtDate(next)) : "—"}</strong></div>
          <div><span>Ocorrências geradas</span><strong>${generated}</strong></div>
          <div><span>Categoria</span><strong>${esc(rule.category)}</strong></div>
          <div><span>Geração</span><strong>${rule.reviewBeforeGenerate ? "Com revisão" : "Automática"}</strong></div>
        </div>
        ${rule.note ? `<p class="small muted mt-12">${esc(rule.note)}</p>` : ""}
        <div class="content-actions mt-16">
          ${rule.status === "active" ? `<button class="btn sm primary" data-recurring-generate="${esc(rule.id)}">${icon("repeat")}Gerar ocorrências</button>` : ""}
          <button class="btn sm ghost" data-recurring-edit="${esc(rule.id)}">${icon("edit")}Editar</button>
          ${rule.status === "active" ? `<button class="btn sm subtle" data-recurring-pause="${esc(rule.id)}">Pausar</button><button class="btn sm ghost" data-recurring-end="${esc(rule.id)}">Encerrar</button>` : ""}
          ${rule.status === "paused" ? `<button class="btn sm subtle" data-recurring-resume="${esc(rule.id)}">${icon("refresh")}Retomar</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function bindCards(root, rules) {
    root.querySelectorAll("[data-recurring-edit]").forEach((button) => button.addEventListener("click", () => openRuleForm(rules.find((rule) => rule.id === button.dataset.recurringEdit))));
    root.querySelectorAll("[data-recurring-generate]").forEach((button) => button.addEventListener("click", () => openGenerateForm(rules.find((rule) => rule.id === button.dataset.recurringGenerate))));
    root.querySelectorAll("[data-recurring-pause]").forEach((button) => button.addEventListener("click", () => run(FM.actions.setRecurringStatus(button.dataset.recurringPause, "paused"))));
    root.querySelectorAll("[data-recurring-resume]").forEach((button) => button.addEventListener("click", () => run(FM.actions.setRecurringStatus(button.dataset.recurringResume, "active"))));
    root.querySelectorAll("[data-recurring-end]").forEach((button) => button.addEventListener("click", async () => {
      const rule = rules.find((item) => item.id === button.dataset.recurringEnd);
      const ok = await FM.ui.confirm({ title: "Encerrar recorrência", message: `“${esc(rule.description)}” não gerará novas ocorrências. Os lançamentos já criados serão preservados.`, confirmLabel: "Encerrar" });
      if (ok) await run(FM.actions.setRecurringStatus(rule.id, "ended"));
    }));
  }

  function viewRecorrencias() {
    let filter = "active";
    let query = "";
    const rules = FM.store.state.recurring || [];
    const active = rules.filter((rule) => rule.status === "active");
    const generatedMonth = FM.store.state.transactions.filter((tx) => tx.recurrenceId && tx.date?.startsWith(FM.store.ui.month)).length;
    const review = rules.filter((rule) => rule.reviewBeforeGenerate && rule.status !== "ended").length;
    const mount = document.querySelector("#view");
    mount.innerHTML = `<div class="view">
      <div class="page-heading"><div><span class="eyebrow">Rotina financeira</span><h2>Recorrências</h2><p>Programe compromissos e receitas sem duplicar lançamentos.</p></div><div class="content-actions"><button class="btn primary" data-new-recurring>${icon("plus")}Nova recorrência</button></div></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Regras ativas</span><span class="kpi-icon purple">${icon("repeat")}</span></div><div class="kpi-value">${active.length}</div><div class="kpi-foot">${rules.filter((rule) => rule.status === "paused").length} pausada(s)</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Pendências até hoje</span><span class="kpi-icon amber">${icon("clock")}</span></div><div class="kpi-value" id="recurring-due-count">…</div><div class="kpi-foot">Ocorrências ainda não geradas</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Geradas no mês</span><span class="kpi-icon cyan">${icon("calendar")}</span></div><div class="kpi-value">${generatedMonth}</div><div class="kpi-foot">${esc(FM.utils.monthLabel(FM.store.ui.month, "long"))}</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Exigem revisão</span><span class="kpi-icon green">${icon("check-circle")}</span></div><div class="kpi-value">${review}</div><div class="kpi-foot">Seleção explícita antes da geração</div></div>
      </div>
      <div class="card"><div class="card-body shopping-toolbar"><div class="tabs" role="tablist" aria-label="Filtrar recorrências">
        ${[["active", "Ativas"], ["paused", "Pausadas"], ["ended", "Encerradas"], ["all", "Todas"]].map(([value, label]) => `<button class="tab ${filter === value ? "active" : ""}" data-recurring-filter="${value}" role="tab" aria-selected="${filter === value}">${label}</button>`).join("")}
      </div><label class="search-inline">${icon("search")}<input class="input" id="recurring-search" placeholder="Buscar descrição ou categoria..." value="${esc(query)}"></label></div></div>
      <div id="recurring-results" class="recurring-grid mt-16"></div>
    </div>`;

    const results = mount.querySelector("#recurring-results");
    const paint = () => {
      const normalized = query.trim().toLowerCase();
      const filtered = rules.filter((rule) => (filter === "all" || rule.status === filter) && (!normalized || [rule.description, rule.category, FM.calc.accountName(rule.account)].join(" ").toLowerCase().includes(normalized)));
      results.innerHTML = filtered.length ? filtered.map(ruleCard).join("") : FM.ui.emptyState("repeat", "Nenhuma recorrência encontrada", filter === "active" ? "Crie uma regra para gerar previsões sem repetição." : "Altere o filtro ou cadastre uma nova regra.", `<button class="btn primary mt-12" data-new-recurring>${icon("plus")}Criar recorrência</button>`);
      results.querySelectorAll("[data-new-recurring]").forEach((button) => button.addEventListener("click", () => openRuleForm(null)));
      bindCards(results, rules);
    };
    mount.querySelector("[data-new-recurring]").addEventListener("click", () => openRuleForm(null));
    mount.querySelectorAll("[data-recurring-filter]").forEach((button) => button.addEventListener("click", () => {
      filter = button.dataset.recurringFilter;
      mount.querySelectorAll("[data-recurring-filter]").forEach((item) => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-selected", String(item === button));
      });
      paint();
    }));
    mount.querySelector("#recurring-search").addEventListener("input", (event) => { query = event.target.value; paint(); });
    paint();
    Promise.all(active.map((rule) => FM.actions.previewRecurring(rule.id, todayISO()).then((items) => items.length).catch(() => 0))).then((counts) => {
      const counter = mount.querySelector("#recurring-due-count");
      if (counter?.isConnected) counter.textContent = counts.reduce((total, count) => total + count, 0);
    });
  }

  FM.views = FM.views || {};
  FM.views.recorrencias = viewRecorrencias;
})();

(function () {
  "use strict";
  const FM = window.FM;
  const { esc, fmtDate, num } = FM.utils;
  const icon = FM.ui.icon;
  const PRIORITY = { low: "Baixa", normal: "Normal", high: "Alta" };

  function run(promise) {
    return Promise.resolve(promise).then(() => true).catch((error) => {
      FM.ui.toast(error.message || "Não foi possível concluir a operação.", "error");
      return false;
    });
  }

  function localDateISO(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function localDateTime(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function displayWhen(remindAt) {
    if (!remindAt) return "Sem data e hora";
    const date = new Date(remindAt);
    return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function linkOptions(type, selected) {
    if (type === "account") {
      return FM.store.state.accounts.filter((account) => account.active || account.id === selected)
        .map((account) => `<option value="${esc(account.id)}" ${account.id === selected ? "selected" : ""}>${esc(account.name)}</option>`).join("");
    }
    if (type === "goal") {
      return FM.store.state.goals.filter((goal) => goal.status !== "cancelled" || goal.id === selected)
        .map((goal) => `<option value="${esc(goal.id)}" ${goal.id === selected ? "selected" : ""}>${esc(goal.name)}</option>`).join("");
    }
    if (type === "transaction") {
      const transactions = [...FM.store.state.transactions].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.id).localeCompare(String(a.id)));
      const recent = transactions.slice(0, 300);
      if (selected && !recent.some((tx) => tx.id === selected)) {
        const existing = FM.calc.txById(selected);
        if (existing) recent.unshift(existing);
      }
      return recent.map((tx) => `<option value="${esc(tx.id)}" ${tx.id === selected ? "selected" : ""}>${esc(fmtDate(tx.date))} · ${esc(tx.description)} · ${esc(FM.utils.money(tx.amount))}</option>`).join("");
    }
    return "";
  }

  function linkedItem(reminder) {
    if (!reminder.linkType) return "";
    if (reminder.linkType === "account") return `${icon("bank")}<span>Conta: ${esc(FM.calc.accountName(reminder.linkId))}</span>`;
    if (reminder.linkType === "goal") {
      const goal = FM.store.state.goals.find((item) => item.id === reminder.linkId);
      return `${icon("target")}<span>Meta: ${esc(goal?.name || "Item removido")}</span>`;
    }
    const tx = FM.calc.txById(reminder.linkId);
    if (!tx) return `${icon("alert")}<span>Movimentação vinculada removida</span>`;
    return `<button type="button" class="link-button" data-open-tx="${esc(tx.id)}">${icon("receipt")}<span>${esc(tx.description)} · ${esc(FM.utils.money(tx.amount))}</span></button>`;
  }

  function openReminderForm(reminder) {
    const editing = !!reminder;
    const type = reminder?.type || "note";
    const priority = reminder?.priority || "normal";
    const linkType = reminder?.linkType || "";
    FM.ui.modalForm({
      title: editing ? "Editar lembrete" : "Novo lembrete",
      subtitle: "Organize anotações e compromissos financeiros em um só lugar.",
      submitLabel: editing ? "Salvar lembrete" : "Criar lembrete",
      submitIcon: "check",
      body: `<div class="form-grid">
        <div class="field full"><label for="reminder-title">Título</label><input class="input" id="reminder-title" name="title" maxlength="140" value="${esc(reminder?.title || "")}" placeholder="Ex.: Pagar fatura do cartão"></div>
        <div class="field"><label for="reminder-type">Tipo</label><select class="select" id="reminder-type" name="type"><option value="note" ${type === "note" ? "selected" : ""}>Anotação livre</option><option value="financial" ${type === "financial" ? "selected" : ""}>Lembrete financeiro</option></select></div>
        <div class="field"><label for="reminder-priority">Prioridade</label><select class="select" id="reminder-priority" name="priority">${Object.entries(PRIORITY).map(([value, label]) => `<option value="${value}" ${priority === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field full"><label for="reminder-at">Data e hora</label><input class="input" type="datetime-local" id="reminder-at" name="remindAt" value="${esc(reminder?.remindAt ? localDateTime(reminder.remindAt) : "")}"><span class="field-hint">Opcional. O horário é interpretado no fuso deste navegador.</span></div>
        <div class="field"><label for="reminder-link-type">Vincular a</label><select class="select" id="reminder-link-type" name="linkType"><option value="">Nenhum item</option><option value="account" ${linkType === "account" ? "selected" : ""}>Conta</option><option value="goal" ${linkType === "goal" ? "selected" : ""}>Meta</option><option value="transaction" ${linkType === "transaction" ? "selected" : ""}>Movimentação</option></select></div>
        <div class="field" id="reminder-link-field" ${linkType ? "" : "hidden"}><label for="reminder-link-id">Item vinculado</label><select class="select" id="reminder-link-id" name="linkId">${linkOptions(linkType, reminder?.linkId || "")}</select></div>
        <div class="field full"><label class="check-line"><input type="checkbox" name="completed" ${reminder?.completed ? "checked" : ""}><span>Lembrete concluído</span></label></div>
        <div class="field full"><label for="reminder-note">Observação</label><textarea class="textarea" id="reminder-note" name="note" maxlength="600" placeholder="Detalhes, valor, combinado ou informação útil">${esc(reminder?.note || "")}</textarea></div>
      </div>`,
      onMount: (ov) => {
        const linkTypeField = ov.querySelector("#reminder-link-type");
        const linkField = ov.querySelector("#reminder-link-field");
        const linkIdField = ov.querySelector("#reminder-link-id");
        linkTypeField.addEventListener("change", () => {
          linkField.hidden = !linkTypeField.value;
          linkIdField.innerHTML = linkOptions(linkTypeField.value, "");
        });
      },
      onSubmit: (data) => {
        const selectedLinkType = data.get("linkType");
        return FM.actions.saveReminder({
          title: data.get("title"), type: data.get("type"), priority: data.get("priority"),
          remindAt: data.get("remindAt"), linkType: selectedLinkType,
          linkId: selectedLinkType ? data.get("linkId") : "", completed: data.get("completed") === "on",
          note: data.get("note"),
        }, reminder?.id);
      },
    });
  }

  function reminderCard(reminder, now) {
    const overdue = !reminder.completed && reminder.remindAt && new Date(reminder.remindAt).getTime() < now.getTime();
    return `<article class="card reminder-card ${reminder.completed ? "is-completed" : ""} ${overdue ? "is-overdue" : ""}">
      <div class="card-head">
        <div><div class="card-title">${icon(reminder.completed ? "check-circle" : reminder.type === "financial" ? "wallet" : "bell")}${esc(reminder.title)}</div><p class="small muted mt-4">${reminder.type === "financial" ? "Lembrete financeiro" : "Anotação livre"}${reminder.completedAt ? ` · concluído em ${esc(new Date(reminder.completedAt).toLocaleDateString("pt-BR"))}` : ""}</p></div>
        <span class="badge ${reminder.completed ? "success" : reminder.priority === "high" ? "danger" : reminder.priority === "low" ? "muted" : "amber"}">${reminder.completed ? "Concluído" : PRIORITY[reminder.priority] || "Normal"}</span>
      </div>
      <div class="card-body">
        <div class="reminder-when ${overdue ? "text-red" : ""}">${icon(overdue ? "alert" : "clock")}<span>${overdue ? "Atrasado · " : ""}${esc(displayWhen(reminder.remindAt))}</span></div>
        ${reminder.note ? `<p class="reminder-note">${esc(reminder.note)}</p>` : ""}
        ${reminder.linkType ? `<div class="reminder-link">${linkedItem(reminder)}</div>` : ""}
        <div class="content-actions mt-16">
          <button class="btn sm ${reminder.completed ? "subtle" : "primary"}" data-reminder-toggle="${esc(reminder.id)}">${icon(reminder.completed ? "refresh" : "check")}${reminder.completed ? "Reabrir" : "Concluir"}</button>
          <button class="btn sm ghost" data-reminder-edit="${esc(reminder.id)}">${icon("edit")}Editar</button>
          <button class="btn sm ghost text-red" data-reminder-delete="${esc(reminder.id)}">${icon("trash")}Excluir</button>
        </div>
      </div>
    </article>`;
  }

  function bindCards(root, reminders, now) {
    root.querySelectorAll("[data-reminder-toggle]").forEach((button) => button.addEventListener("click", () => run(FM.actions.toggleReminder(button.dataset.reminderToggle))));
    root.querySelectorAll("[data-reminder-edit]").forEach((button) => button.addEventListener("click", () => openReminderForm(reminders.find((reminder) => reminder.id === button.dataset.reminderEdit))));
    root.querySelectorAll("[data-reminder-delete]").forEach((button) => button.addEventListener("click", async () => {
      const reminder = reminders.find((item) => item.id === button.dataset.reminderDelete);
      const ok = await FM.ui.confirm({ title: "Excluir lembrete", message: `Remover “${esc(reminder.title)}”? Esta ação não afeta lançamentos ou contas vinculadas.`, confirmLabel: "Excluir", danger: true });
      if (ok) await run(FM.actions.deleteReminder(reminder.id));
    }));
  }

  function viewLembretes() {
    let filter = "pending";
    let priority = "all";
    let query = "";
    const reminders = FM.store.state.reminders || [];
    const now = new Date();
    const today = localDateISO(now);
    const pending = reminders.filter((reminder) => !reminder.completed);
    const overdue = pending.filter((reminder) => reminder.remindAt && new Date(reminder.remindAt) < now).length;
    const dueToday = pending.filter((reminder) => reminder.remindAt && localDateISO(reminder.remindAt) === today).length;
    const high = pending.filter((reminder) => reminder.priority === "high").length;
    const mount = document.querySelector("#view");
    mount.innerHTML = `<div class="view">
      <div class="page-heading"><div><span class="eyebrow">Rotina doméstica</span><h2>Lembretes</h2><p>Não perca prazos, anotações e compromissos da família.</p></div><div class="content-actions"><button class="btn primary" data-new-reminder>${icon("plus")}Novo lembrete</button></div></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Pendentes</span><span class="kpi-icon purple">${icon("bell")}</span></div><div class="kpi-value">${pending.length}</div><div class="kpi-foot">${reminders.filter((reminder) => reminder.completed).length} concluído(s)</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Atrasados</span><span class="kpi-icon red">${icon("alert")}</span></div><div class="kpi-value neg">${overdue}</div><div class="kpi-foot">Data e hora já passaram</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Para hoje</span><span class="kpi-icon amber">${icon("clock")}</span></div><div class="kpi-value">${dueToday}</div><div class="kpi-foot">${esc(now.toLocaleDateString("pt-BR"))}</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Prioridade alta</span><span class="kpi-icon green">${icon("flag")}</span></div><div class="kpi-value">${high}</div><div class="kpi-foot">Lembretes pendentes</div></div>
      </div>
      <div class="card"><div class="card-body shopping-toolbar"><div class="tabs" role="tablist" aria-label="Filtrar lembretes">
        ${[["pending", "Pendentes"], ["completed", "Concluídos"], ["all", "Todos"]].map(([value, label]) => `<button class="tab ${filter === value ? "active" : ""}" data-reminder-filter="${value}" role="tab" aria-selected="${filter === value}">${label}</button>`).join("")}
      </div><div class="reminder-tools"><label class="search-inline">${icon("search")}<input class="input" id="reminder-search" placeholder="Buscar título ou observação..." value="${esc(query)}"></label><select class="select" id="reminder-priority-filter" aria-label="Filtrar por prioridade"><option value="all">Todas as prioridades</option>${Object.entries(PRIORITY).map(([value, label]) => `<option value="${value}" ${priority === value ? "selected" : ""}>Prioridade ${label.toLowerCase()}</option>`).join("")}</select></div></div></div>
      <div id="reminder-results" class="reminder-grid mt-16"></div>
    </div>`;

    const results = mount.querySelector("#reminder-results");
    const paint = () => {
      const normalized = query.trim().toLowerCase();
      const filtered = reminders.filter((reminder) => {
        const statusMatch = filter === "all" || reminder.completed === (filter === "completed");
        const priorityMatch = priority === "all" || reminder.priority === priority;
        const textMatch = !normalized || [reminder.title, reminder.note].join(" ").toLowerCase().includes(normalized);
        return statusMatch && priorityMatch && textMatch;
      }).sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        const rank = { high: 0, normal: 1, low: 2 };
        if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
        return String(a.remindAt || "9999").localeCompare(String(b.remindAt || "9999"));
      });
      results.innerHTML = filtered.length ? filtered.map((reminder) => reminderCard(reminder, now)).join("") : FM.ui.emptyState("bell", "Nenhum lembrete encontrado", filter === "pending" ? "Crie um lembrete para acompanhar um compromisso ou anotação." : "Altere os filtros para ver outros lembretes.", `<button class="btn primary mt-12" data-new-reminder>${icon("plus")}Criar lembrete</button>`);
      results.querySelectorAll("[data-new-reminder]").forEach((button) => button.addEventListener("click", () => openReminderForm(null)));
      bindCards(results, reminders, now);
    };
    mount.querySelector("[data-new-reminder]").addEventListener("click", () => openReminderForm(null));
    mount.querySelectorAll("[data-reminder-filter]").forEach((button) => button.addEventListener("click", () => {
      filter = button.dataset.reminderFilter;
      mount.querySelectorAll("[data-reminder-filter]").forEach((item) => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-selected", String(item === button));
      });
      paint();
    }));
    mount.querySelector("#reminder-search").addEventListener("input", (event) => { query = event.target.value; paint(); });
    mount.querySelector("#reminder-priority-filter").addEventListener("change", (event) => { priority = event.target.value; paint(); });
    paint();
  }

  FM.views = FM.views || {};
  FM.views.lembretes = viewLembretes;
})();

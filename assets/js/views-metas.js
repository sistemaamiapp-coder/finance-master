(function () {
  "use strict";
  const FM = window.FM;
  const { esc, money, fmtDate, todayISO, num, round2 } = FM.utils;
  const icon = FM.ui.icon;
  const STATUS = { active: "Ativa", paused: "Pausada", concluded: "Concluída", cancelled: "Cancelada" };

  function balance(goal) {
    return round2((goal.movements || []).reduce((total, movement) => total + (movement.type === "retirada" ? -num(movement.amount) : num(movement.amount)), num(goal.initialAmount)));
  }

  function cashOptions(selected) {
    const accounts = FM.store.state.accounts.filter((account) => account.active && FM.calc.isCashAccount(account));
    if (!accounts.length) return `<option value="">Cadastre uma conta de caixa primeiro</option>`;
    return accounts.map((account) => `<option value="${esc(account.id)}" data-label="${esc(account.name)}" ${account.id === selected ? "selected" : ""}>${esc(account.name)} · saldo ${money(FM.calc.accountBalance(account.id, "9999-12-31"))}</option>`).join("");
  }

  function investmentOptions(selected) {
    const accounts = FM.store.state.accounts.filter((account) => account.active && account.type === "Investimento");
    return accounts.map((account) => `<option value="${esc(account.id)}" ${account.id === selected ? "selected" : ""}>${esc(account.name)}${account.institution ? " — " + esc(account.institution) : ""}</option>`).join("");
  }

  function openGoalForm(goal) {
    const editing = !!goal;
    FM.ui.modalForm({
      title: editing ? "Editar meta" : "Nova meta",
      subtitle: "A reserva fica separada das despesas e movimenta uma conta de investimento.",
      size: "lg",
      submitLabel: editing ? "Salvar meta" : "Criar meta",
      submitIcon: "check",
      body: `<div class="form-grid">
        <div class="field"><label for="goal-name">Nome da meta</label><input class="input" id="goal-name" name="name" maxlength="80" value="${esc(goal?.name || "")}" placeholder="Ex.: Reserva de emergência"></div>
        <div class="field"><label for="goal-target">Valor desejado</label><div class="money-wrap"><span>R$</span><input class="input money" id="goal-target" name="target" inputmode="decimal" value="${String(goal?.target || "").replace(".", ",")}"></div></div>
        <div class="field"><label for="goal-start">Data de início</label><input class="input" type="date" id="goal-start" name="startDate" value="${esc(goal?.startDate || todayISO())}" ${editing ? "disabled" : ""}></div>
        <div class="field"><label for="goal-date">Data prevista</label><input class="input" type="date" id="goal-date" name="targetDate" value="${esc(goal?.targetDate || "")}"></div>
        <div class="field"><label for="goal-account">Conta de investimento</label><select class="select" id="goal-account" name="account" ${editing ? "disabled" : ""}>${editing ? `<option value="${esc(goal.account)}" selected>${esc(FM.calc.accountName(goal.account))}</option>` : investmentOptions("")}</select></div>
        <div class="field"><label for="goal-initial">Valor inicial</label><div class="money-wrap"><span>R$</span><input class="input money" id="goal-initial" name="initialAmount" inputmode="decimal" value="${String(goal?.initialAmount || 0).replace(".", ",")}" ${editing ? "disabled" : ""}></div></div>
        ${!editing ? `<div class="field full"><label for="goal-initial-account">Conta de origem do valor inicial</label><select class="select" id="goal-initial-account" name="initialAccount">${cashOptions("")}</select><span class="field-hint">O valor inicial será transferido uma única vez. Se for zero, a origem não é necessária.</span></div>` : ""}
        <div class="field"><label for="goal-status">Status</label><select class="select" id="goal-status" name="status">${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${goal?.status === value || (!goal && value === "active") ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field"><label for="goal-negative">Saldo negativo</label><select class="select" id="goal-negative" name="allowNegative"><option value="false" ${goal && !goal.allowNegative ? "selected" : ""}>Bloquear retiradas além do saldo</option><option value="true" ${goal?.allowNegative ? "selected" : ""}>Permitir com confirmação explícita</option></select></div>
        <div class="field full"><label for="goal-description">Descrição</label><textarea class="textarea" id="goal-description" name="description" maxlength="400" placeholder="Detalhes do objetivo, destino ou combinado da família">${esc(goal?.description || "")}</textarea></div>
      </div>`,
      onSubmit: async (data) => {
        const account = goal ? goal.account : data.get("account");
        const initialAmount = goal ? goal.initialAmount : data.get("initialAmount");
        return FM.actions.saveGoal({
          name: data.get("name"), target: data.get("target"), startDate: goal ? goal.startDate : data.get("startDate"),
          targetDate: data.get("targetDate"), account, initialAmount,
          initialAccount: data.get("initialAccount"), description: data.get("description"),
          status: data.get("status"), allowNegative: data.get("allowNegative") === "true",
        }, goal?.id);
      },
    });
  }

  function openMovementForm(goal, type) {
    const current = balance(goal);
    FM.ui.modalForm({
      title: type === "deposito" ? "Depositar na meta" : "Retirar da meta",
      subtitle: `${goal.name} · acumulado ${money(current)}`,
      submitLabel: type === "deposito" ? "Registrar depósito" : "Registrar retirada",
      submitIcon: type === "deposito" ? "arrow-down" : "arrow-up",
      body: `<div class="form-grid">
        <div class="field"><label for="movement-type">Movimento</label><select class="select" id="movement-type" name="type"><option value="deposito" ${type === "deposito" ? "selected" : ""}>Depósito</option><option value="retirada" ${type === "retirada" ? "selected" : ""}>Retirada</option></select></div>
        <div class="field"><label for="movement-amount">Valor</label><div class="money-wrap"><span>R$</span><input class="input money" id="movement-amount" name="amount" inputmode="decimal"></div></div>
        <div class="field"><label for="movement-date">Data</label><input class="input" type="date" id="movement-date" name="date" value="${todayISO()}"></div>
        <div class="field"><label for="movement-account">Conta de ${type === "deposito" ? "origem" : "destino"}</label><select class="select" id="movement-account" name="counterpartAccount">${cashOptions("")}</select></div>
        <div class="field full"><label for="movement-note">Observação</label><input class="input" id="movement-note" name="note" maxlength="240" placeholder="Opcional"></div>
      </div>
      <div class="analytics-callout mt-12" id="negative-warning" hidden>${icon("alert")}<span>A retirada deixará a meta com saldo negativo. Marque a confirmação abaixo para continuar.</span></div>
      <label class="check-line mt-12" id="negative-confirm-row" hidden><input type="checkbox" name="confirmNegative"><span>Confirmo a retirada além do valor acumulado nesta meta.</span></label>`,
      onMount: (ov) => {
        const amount = ov.querySelector("#movement-amount");
        const movementType = ov.querySelector("#movement-type");
        const account = ov.querySelector("#movement-account");
        const accountLabel = ov.querySelector('label[for="movement-account"]');
        const update = () => {
          const withdrawing = movementType.value === "retirada";
          const negative = withdrawing && current - num(amount.value) < 0;
          ov.querySelector("#negative-warning").hidden = !negative;
          ov.querySelector("#negative-confirm-row").hidden = !negative;
          accountLabel.textContent = `Conta de ${withdrawing ? "destino" : "origem"}`;
          account.querySelectorAll("option").forEach((option) => { option.textContent = `${option.dataset.label || ""} · saldo ${money(FM.calc.accountBalance(option.value, "9999-12-31"))}`; });
        };
        amount.addEventListener("input", update);
        movementType.addEventListener("change", update);
        update();
      },
      onSubmit: async (data) => {
        const movementType = data.get("type");
        const counterpartAccount = data.get("counterpartAccount");
        const amount = num(data.get("amount"));
        const negative = movementType === "retirada" && current - amount < 0;
        return FM.actions.addGoalMovement(goal.id, {
          type: movementType, amount, date: data.get("date"), counterpartAccount,
          note: data.get("note"), confirmNegative: negative && data.get("confirmNegative") === "on",
        });
      },
    });
  }

  function goalCard(goal) {
    const current = balance(goal);
    const remaining = round2(Math.max(0, num(goal.target) - current));
    const progress = Math.max(0, Math.min(100, num(goal.target) > 0 ? current / num(goal.target) * 100 : 0));
    const done = current >= num(goal.target);
    return `<article class="card goal-card">
      <div class="card-head">
        <div><div class="card-title">${icon(done ? "check-circle" : "target")}${esc(goal.name)}</div><p class="small muted mt-4">${esc(FM.calc.accountName(goal.account))} · ${STATUS[goal.status] || "Ativa"}</p></div>
        <span class="badge ${goal.status === "active" ? "success" : goal.status === "cancelled" ? "danger" : "muted"}">${STATUS[goal.status] || "Ativa"}</span>
      </div>
      <div class="card-body">
        <div class="goal-amounts"><div><span>Acumulado</span><strong class="${current < 0 ? "text-red" : ""}">${money(current)}</strong></div><div class="text-right"><span>Faltam</span><strong>${money(remaining)}</strong></div></div>
        <div class="progress ${done ? "green" : ""} tall" role="progressbar" aria-label="Progresso da meta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>
        <div class="goal-meta"><span>${Math.round(progress)}% de ${money(goal.target)}</span><span>${goal.targetDate ? "Até " + esc(fmtDate(goal.targetDate)) : "Sem data prevista"}</span></div>
        ${goal.description ? `<p class="small muted mt-12">${esc(goal.description)}</p>` : ""}
        <div class="content-actions mt-16">
          ${goal.status === "active" ? `<button class="btn sm primary" data-goal-deposit="${esc(goal.id)}">${icon("arrow-down")}Depositar</button><button class="btn sm subtle" data-goal-withdraw="${esc(goal.id)}">${icon("arrow-up")}Retirar</button>` : ""}
          <button class="btn sm ghost" data-goal-edit="${esc(goal.id)}">${icon("edit")}Editar</button>
          ${goal.status === "paused" ? `<button class="btn sm subtle" data-goal-resume="${esc(goal.id)}">${icon("refresh")}Retomar</button>` : ""}
          ${goal.status === "active" ? `<button class="btn sm ghost" data-goal-pause="${esc(goal.id)}">Pausar</button>` : ""}
          ${goal.status !== "cancelled" && goal.status !== "concluded" ? `<button class="btn sm ghost" data-goal-conclude="${esc(goal.id)}">Concluir</button><button class="btn sm ghost text-red" data-goal-cancel="${esc(goal.id)}">Cancelar</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function history(goals) {
    const movements = goals.flatMap((goal) => (goal.movements || []).map((movement) => ({ ...movement, goalId: goal.id, goalName: goal.name })))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || String(b.id).localeCompare(String(a.id)));
    if (!movements.length) return FM.ui.emptyState("transfer", "Nenhum movimento ainda", "Deposite ou retire valores para acompanhar o histórico da reserva.");
    return `<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Meta</th><th>Movimento</th><th>Conta</th><th>Observação</th><th class="text-right">Valor</th><th></th></tr></thead><tbody>
      ${movements.map((movement) => {
        const reversed = goals.find((goal) => goal.id === movement.goalId)?.movements.some((item) => item.reversalOf === movement.id);
        return `<tr><td>${esc(fmtDate(movement.date))}</td><td>${esc(movement.goalName)}</td><td><span class="type-mark ${movement.type === "deposito" ? "receita" : "despesa"}">${icon(movement.type === "deposito" ? "arrow-down" : "arrow-up")}</span>${movement.type === "deposito" ? "Depósito" : "Retirada"}${movement.reversalOf ? " · estorno" : ""}${reversed ? " · estornado" : ""}</td><td>${esc(FM.calc.accountName(movement.counterpartAccount))}</td><td>${esc(movement.note || "—")}</td><td class="text-right ${movement.type === "deposito" ? "text-green" : "text-red"}">${movement.type === "deposito" ? "+" : "−"}${money(movement.amount)}</td><td>${!movement.reversalOf && !reversed ? `<button class="icon-btn sm" data-goal-reverse="${esc(movement.goalId)}:${esc(movement.id)}" title="Estornar movimento" aria-label="Estornar movimento">${icon("refresh")}</button>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function viewMetas() {
    const run = (promise) => Promise.resolve(promise).catch((error) => FM.ui.toast(error.message || "Não foi possível concluir a operação.", "error"));
    const goals = FM.store.state.goals || [];
    const visible = goals.filter((goal) => goal.status !== "cancelled");
    const reserved = round2(visible.reduce((total, goal) => total + balance(goal), 0));
    const target = round2(visible.reduce((total, goal) => total + num(goal.target), 0));
    const completed = visible.filter((goal) => balance(goal) >= num(goal.target)).length;
    const hasInvestments = FM.store.state.accounts.some((account) => account.active && account.type === "Investimento");
    const month = FM.store.ui.month;
    const deposited = round2(goals.flatMap((goal) => goal.movements || []).filter((movement) => movement.type === "deposito" && !movement.reversalOf && movement.date.startsWith(month)).reduce((total, movement) => total + num(movement.amount), 0));

    const mount = document.querySelector("#view");
    mount.innerHTML = `<div class="view">
      <div class="page-heading"><div><span class="eyebrow">Planejamento</span><h2>Metas e economias</h2><p>Transforme planos em reservas, sem confundir investimento com despesa.</p></div><div class="content-actions">${hasInvestments ? `<button class="btn primary" data-new-goal>${icon("plus")}Nova meta</button>` : `<a class="btn primary" href="#/contas">${icon("plus")}Criar conta de investimento</a>`}</div></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Reservado em metas</span><span class="kpi-icon green">${icon("wallet")}</span></div><div class="kpi-value pos">${money(reserved)}</div><div class="kpi-foot">${visible.length} meta(s) não cancelada(s)</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Objetivos somados</span><span class="kpi-icon purple">${icon("target")}</span></div><div class="kpi-value">${money(target)}</div><div class="kpi-foot">${completed} concluída(s) pelo valor</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Depósitos no mês</span><span class="kpi-icon cyan">${icon("arrow-down")}</span></div><div class="kpi-value">${money(deposited)}</div><div class="kpi-foot">${esc(FM.utils.monthLabel(month, "long"))}</div></div>
      </div>
      ${!hasInvestments ? `<div class="analytics-callout mb-16">${icon("info")}<span>Cadastre uma conta do tipo <b>Investimento</b> em Contas e investimentos para criar metas e movimentar reservas.</span></div>` : ""}
      ${visible.length ? `<div class="goal-grid">${visible.map(goalCard).join("")}</div>` : FM.ui.emptyState("target", "Nenhuma meta cadastrada", "Crie um objetivo e defina quanto deseja separar por mês.", hasInvestments ? `<button class="btn primary mt-12" data-new-goal>${icon("plus")}Criar primeira meta</button>` : "")}
      <div class="card mt-16"><div class="card-head with-divider"><div><div class="card-title">${icon("transfer")}Histórico de movimentos</div><p class="small muted mt-4">Depósitos e retiradas aparecem também como transferências entre contas.</p></div></div><div class="card-body">${history(goals)}</div></div>
    </div>`;

    mount.querySelectorAll("[data-new-goal]").forEach((button) => button.addEventListener("click", () => openGoalForm(null)));
    mount.querySelectorAll("[data-goal-edit]").forEach((button) => button.addEventListener("click", () => openGoalForm(goals.find((goal) => goal.id === button.dataset.goalEdit))));
    mount.querySelectorAll("[data-goal-deposit]").forEach((button) => button.addEventListener("click", () => openMovementForm(goals.find((goal) => goal.id === button.dataset.goalDeposit), "deposito")));
    mount.querySelectorAll("[data-goal-withdraw]").forEach((button) => button.addEventListener("click", () => openMovementForm(goals.find((goal) => goal.id === button.dataset.goalWithdraw), "retirada")));
    mount.querySelectorAll("[data-goal-pause]").forEach((button) => button.addEventListener("click", () => run(FM.actions.setGoalStatus(button.dataset.goalPause, "paused"))));
    mount.querySelectorAll("[data-goal-resume]").forEach((button) => button.addEventListener("click", () => run(FM.actions.setGoalStatus(button.dataset.goalResume, "active"))));
    mount.querySelectorAll("[data-goal-conclude]").forEach((button) => button.addEventListener("click", async () => {
      const ok = await FM.ui.confirm({ title: "Concluir meta", message: "A meta ficará concluída e não aceitará novos movimentos.", confirmLabel: "Concluir" });
      if (ok) await run(FM.actions.setGoalStatus(button.dataset.goalConclude, "concluded"));
    }));
    mount.querySelectorAll("[data-goal-cancel]").forEach((button) => button.addEventListener("click", async () => {
      const ok = await FM.ui.confirm({ title: "Cancelar meta", message: "O histórico e os valores já transferidos serão preservados. A meta ficará cancelada.", confirmLabel: "Cancelar meta", danger: true });
      if (ok) await run(FM.actions.setGoalStatus(button.dataset.goalCancel, "cancelled"));
    }));
    mount.querySelectorAll("[data-goal-reverse]").forEach((button) => button.addEventListener("click", async () => {
      const [goalId, movementId] = button.dataset.goalReverse.split(":");
      const ok = await FM.ui.confirm({ title: "Estornar movimento", message: "Será criada uma transferência inversa e um movimento de estorno. O histórico original será mantido.", confirmLabel: "Estornar", danger: true });
      if (ok) await run(FM.actions.reverseGoalMovement(goalId, movementId));
    }));
  }

  FM.views = FM.views || {};
  FM.views.metas = viewMetas;
})();

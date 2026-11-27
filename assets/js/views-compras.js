(function () {
  "use strict";
  const FM = window.FM;
  const { esc, money, fmtDate, todayISO, num, round2 } = FM.utils;
  const icon = FM.ui.icon;
  const STATUS = { active: "Ativa", completed: "Concluída", archived: "Arquivada" };
  const UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct", "maço", "outro"];

  function totals(list) {
    const items = list.items || [];
    return {
      estimated: round2(items.reduce((total, item) => total + num(item.quantity) * num(item.estimatedPrice), 0)),
      effective: round2(items.filter((item) => item.purchased).reduce((total, item) => total + num(item.quantity) * num(item.effectivePrice), 0)),
      purchased: items.filter((item) => item.purchased).length,
    };
  }

  function expenseCategories(selected) {
    const seen = new Set();
    return FM.store.state.categories.filter((category) => {
      if (category.type !== "Despesa" || seen.has(category.name)) return false;
      seen.add(category.name);
      return true;
    }).map((category) => `<option value="${esc(category.name)}" ${category.name === selected ? "selected" : ""}>${esc(category.name)}</option>`).join("");
  }

  function cashOptions(selected) {
    return FM.store.state.accounts.filter((account) => account.active && FM.calc.isCashAccount(account)).map((account) => `<option value="${esc(account.id)}" ${account.id === selected ? "selected" : ""}>${esc(account.name)} · saldo ${money(FM.calc.accountBalance(account.id, "9999-12-31"))}</option>`).join("");
  }

  function run(promise) {
    return Promise.resolve(promise).then(() => true).catch((error) => {
      FM.ui.toast(error.message || "Não foi possível concluir a operação.", "error");
      return false;
    });
  }

  function openListForm(list) {
    FM.ui.modalForm({
      title: list ? "Editar lista de compras" : "Nova lista de compras",
      subtitle: "Organize a compra antes de ir ao mercado e acompanhe o orçamento.",
      submitLabel: list ? "Salvar lista" : "Criar lista",
      submitIcon: "check",
      body: `<div class="form-grid">
        <div class="field"><label for="shopping-name">Nome da lista</label><input class="input" id="shopping-name" name="name" maxlength="80" value="${esc(list?.name || "")}" placeholder="Ex.: Supermercado da semana"></div>
        <div class="field"><label for="shopping-budget">Orçamento</label><div class="money-wrap"><span>R$</span><input class="input money" id="shopping-budget" name="budget" inputmode="decimal" value="${String(list?.budget || 0).replace(".", ",")}"></div><span class="field-hint">Use zero para não definir um limite.</span></div>
        <div class="field full"><label class="check-line"><input type="checkbox" name="favorite" ${list?.favorite ? "checked" : ""}><span>Salvar como lista favorita</span></label></div>
      </div>`,
      onSubmit: (data) => FM.actions.saveShoppingList({ name: data.get("name"), budget: data.get("budget"), favorite: data.get("favorite") === "on" }, list?.id),
    });
  }

  function openItemForm(list, item) {
    FM.ui.modalForm({
      title: item ? "Editar item" : "Adicionar item",
      subtitle: list.name,
      submitLabel: item ? "Salvar item" : "Adicionar item",
      submitIcon: "check",
      body: `<div class="form-grid">
        <div class="field full"><label for="item-name">Produto</label><input class="input" id="item-name" name="name" maxlength="100" value="${esc(item?.name || "")}" placeholder="Ex.: Arroz"></div>
        <div class="field"><label for="item-quantity">Quantidade</label><input class="input" id="item-quantity" name="quantity" inputmode="decimal" value="${item?.quantity ?? 1}"></div>
        <div class="field"><label for="item-unit">Unidade</label><select class="select" id="item-unit" name="unit">${UNITS.map((unit) => `<option value="${unit}" ${item?.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}</select></div>
        <div class="field"><label for="item-category">Categoria</label><select class="select" id="item-category" name="category">${expenseCategories(item?.category || "Alimentação")}</select></div>
        <div class="field"><label for="item-estimated">Preço estimado unitário</label><div class="money-wrap"><span>R$</span><input class="input money" id="item-estimated" name="estimatedPrice" inputmode="decimal" value="${String(item?.estimatedPrice || 0).replace(".", ",")}"></div></div>
        <div class="field"><label for="item-effective">Preço efetivo unitário</label><div class="money-wrap"><span>R$</span><input class="input money" id="item-effective" name="effectivePrice" inputmode="decimal" value="${String(item?.effectivePrice || 0).replace(".", ",")}"></div></div>
        <div class="field"><label class="check-line"><input type="checkbox" name="purchased" ${item?.purchased ? "checked" : ""}><span>Item já comprado</span></label></div>
        <div class="field full"><label for="item-note">Observação</label><input class="input" id="item-note" name="note" maxlength="240" value="${esc(item?.note || "")}" placeholder="Marca, tamanho ou observação opcional"></div>
      </div>`,
      onSubmit: (data) => FM.actions.saveShoppingItem(list.id, {
        name: data.get("name"), quantity: data.get("quantity"), unit: data.get("unit"), category: data.get("category"),
        estimatedPrice: data.get("estimatedPrice"), effectivePrice: data.get("effectivePrice"),
        purchased: data.get("purchased") === "on", note: data.get("note"),
      }, item?.id),
    });
  }

  function openFinalizeForm(list) {
    const summary = totals(list);
    const generated = list.generatedTxIds?.length;
    FM.ui.modalForm({
      title: generated ? "Despesa já gerada" : "Finalizar compra",
      subtitle: generated ? "A cobrança desta lista já está registrada." : `${list.name} · ${money(summary.effective)} em itens comprados`,
      submitLabel: generated ? "Fechar" : "Gerar despesa",
      submitIcon: generated ? "check" : "receipt",
      body: generated ? `<div class="analytics-callout">${icon("check-circle")}<span>Esta lista gerou ${list.generatedTxIds.length} lançamento(s). Os itens permanecem bloqueados para evitar uma segunda cobrança.</span></div>` : `<div class="form-grid">
        <div class="field"><label for="finalize-mode">Forma de registro</label><select class="select" id="finalize-mode" name="mode"><option value="consolidated">Uma despesa consolidada</option><option value="per-item">Uma despesa por item</option></select></div>
        <div class="field"><label for="finalize-category">Categoria da despesa</label><select class="select" id="finalize-category" name="category">${expenseCategories("Alimentação")}</select><span class="field-hint">No modo por item, a categoria de cada produto é usada quando disponível.</span></div>
        <div class="field"><label for="finalize-account">Conta de pagamento</label><select class="select" id="finalize-account" name="account">${cashOptions("")}</select></div>
        <div class="field"><label for="finalize-method">Forma de pagamento</label><select class="select" id="finalize-method" name="method">${FM.store.state.settings.methods.map((method) => `<option value="${esc(method)}" ${method === "PIX" ? "selected" : ""}>${esc(method)}</option>`).join("")}</select></div>
        <div class="field"><label for="finalize-date">Data da compra</label><input class="input" type="date" id="finalize-date" name="date" value="${todayISO()}"></div>
        <div class="field full"><label for="finalize-note">Observação da despesa</label><input class="input" id="finalize-note" name="note" maxlength="240" placeholder="Opcional"></div>
      </div>
      <div class="analytics-callout mt-12">${icon("info")}<span>A lista será concluída após registrar a despesa. Não será possível gerar outra cobrança para os mesmos itens.</span></div>`,
      footerLeft: generated ? "" : `<span class="modal-note">${summary.purchased} item(ns) comprado(s)</span>`,
      onSubmit: async (data) => {
        if (generated) return true;
        await FM.actions.generateShoppingExpense(list.id, {
          mode: data.get("mode"), category: data.get("category"), account: data.get("account"),
          method: data.get("method"), date: data.get("date"), note: data.get("note"),
        });
        FM.ui.toast("Despesa registrada e lista concluída.", "success");
        return true;
      },
    });
  }

  function itemRow(list, item) {
    const locked = !!list.generatedTxIds?.length;
    return `<div class="shopping-item ${item.purchased ? "purchased" : ""}">
      <label class="shopping-check"><input type="checkbox" data-shopping-toggle="${esc(list.id)}:${esc(item.id)}" ${item.purchased ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Marcar ${esc(item.name)} como comprado"></label>
      <div class="shopping-item-main"><strong>${esc(item.name)}</strong><span>${esc(num(item.quantity))} ${esc(item.unit)} · ${esc(item.category)}</span>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div>
      <div class="shopping-item-values"><span>Estimado ${money(num(item.quantity) * num(item.estimatedPrice))}</span><strong>${item.purchased ? money(num(item.quantity) * num(item.effectivePrice)) : "—"}</strong></div>
      ${locked ? "" : `<div class="shopping-item-actions"><button class="icon-btn sm" data-shopping-item-edit="${esc(list.id)}:${esc(item.id)}" title="Editar item" aria-label="Editar item">${icon("edit")}</button><button class="icon-btn sm" data-shopping-item-delete="${esc(list.id)}:${esc(item.id)}" title="Excluir item" aria-label="Excluir item">${icon("trash")}</button></div>`}
    </div>`;
  }

  function listCard(list) {
    const summary = totals(list);
    const budget = num(list.budget);
    const available = round2(budget - summary.effective);
    const progress = budget > 0 ? Math.min(100, summary.effective / budget * 100) : 0;
    const firstTx = list.generatedTxIds?.length ? FM.calc.txById(list.generatedTxIds[0]) : null;
    return `<article class="card shopping-card" data-shopping-card="${esc(list.id)}">
      <div class="card-head">
        <div><div class="card-title">${icon(list.favorite ? "sparkles" : "receipt")}${esc(list.name)}</div><p class="small muted mt-4">${summary.purchased} comprado(s) · ${(list.items || []).length - summary.purchased} pendente(s)</p></div>
        <div class="content-actions"><span class="badge ${list.status === "active" ? "success" : list.status === "archived" ? "muted" : "purple"}">${STATUS[list.status] || "Ativa"}</span><button class="icon-btn sm ${list.favorite ? "is-favorite" : ""}" data-shopping-favorite="${esc(list.id)}" title="${list.favorite ? "Remover dos favoritos" : "Marcar como favorita"}" aria-label="Alternar favorito">${icon("sparkles")}</button></div>
      </div>
      <div class="card-body">
        <div class="shopping-totals"><div><span>Orçamento</span><strong>${budget > 0 ? money(budget) : "Sem limite"}</strong></div><div><span>Estimado</span><strong>${money(summary.estimated)}</strong></div><div><span>Comprado</span><strong class="text-green">${money(summary.effective)}</strong></div><div><span>Disponível</span><strong class="${budget > 0 && available < 0 ? "text-red" : ""}">${budget > 0 ? money(available) : "—"}</strong></div></div>
        ${budget > 0 ? `<div class="progress ${summary.effective / budget >= FM.calc.notificationSettings().budgetCritical / 100 ? "red" : summary.effective / budget >= FM.calc.notificationSettings().budgetWarning / 100 ? "amber" : "green"}" role="progressbar" aria-label="Orçamento utilizado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>` : ""}
        <div class="shopping-items mt-12">${list.items?.length ? list.items.map((item) => itemRow(list, item)).join("") : `<div class="shopping-empty">${icon("receipt")}Nenhum item nesta lista.</div>`}</div>
        <div class="content-actions mt-16">
          ${list.status === "active" && !list.generatedTxIds?.length ? `<button class="btn sm subtle" data-shopping-item-add="${esc(list.id)}">${icon("plus")}Adicionar item</button><button class="btn sm primary" data-shopping-finalize="${esc(list.id)}" ${summary.effective > 0 ? "" : "disabled"}>${icon("check")}Finalizar compra</button>` : ""}
          <button class="btn sm ghost" data-shopping-edit="${esc(list.id)}">${icon("edit")}Editar lista</button>
          <button class="btn sm ghost" data-shopping-duplicate="${esc(list.id)}">${icon("file")}Duplicar</button>
          ${firstTx ? `<button class="btn sm subtle" data-open-tx="${esc(firstTx.id)}">${icon("receipt")}Ver despesa</button>` : ""}
          ${list.status !== "archived" ? `<button class="btn sm ghost" data-shopping-archive="${esc(list.id)}">Arquivar</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function bindCards(root) {
    root.querySelectorAll("[data-shopping-item-add]").forEach((button) => button.addEventListener("click", () => openItemForm(FM.store.state.shoppingLists.find((list) => list.id === button.dataset.shoppingItemAdd), null)));
    root.querySelectorAll("[data-shopping-item-edit]").forEach((button) => button.addEventListener("click", () => {
      const [listId, itemId] = button.dataset.shoppingItemEdit.split(":");
      const list = FM.store.state.shoppingLists.find((entry) => entry.id === listId);
      openItemForm(list, list?.items.find((item) => item.id === itemId));
    }));
    root.querySelectorAll("[data-shopping-item-delete]").forEach((button) => button.addEventListener("click", async () => {
      const [listId, itemId] = button.dataset.shoppingItemDelete.split(":");
      const list = FM.store.state.shoppingLists.find((entry) => entry.id === listId);
      const item = list?.items.find((entry) => entry.id === itemId);
      const ok = await FM.ui.confirm({ title: "Excluir item", message: `Remover “${item?.name || "item"}” da lista?`, confirmLabel: "Excluir", danger: true });
      if (ok) await run(FM.actions.deleteShoppingItem(listId, itemId));
    }));
    root.querySelectorAll("[data-shopping-toggle]").forEach((input) => input.addEventListener("change", () => {
      const [listId, itemId] = input.dataset.shoppingToggle.split(":");
      run(FM.actions.toggleShoppingItem(listId, itemId));
    }));
    root.querySelectorAll("[data-shopping-favorite]").forEach((button) => button.addEventListener("click", () => run(FM.actions.toggleShoppingListFavorite(button.dataset.shoppingFavorite))));
    root.querySelectorAll("[data-shopping-edit]").forEach((button) => button.addEventListener("click", () => openListForm(FM.store.state.shoppingLists.find((list) => list.id === button.dataset.shoppingEdit))));
    root.querySelectorAll("[data-shopping-duplicate]").forEach((button) => button.addEventListener("click", async () => {
      const ok = await run(FM.actions.duplicateShoppingList(button.dataset.shoppingDuplicate));
      if (ok) FM.ui.toast("Lista duplicada com os itens pendentes.", "success");
    }));
    root.querySelectorAll("[data-shopping-finalize]").forEach((button) => button.addEventListener("click", () => openFinalizeForm(FM.store.state.shoppingLists.find((list) => list.id === button.dataset.shoppingFinalize))));
    root.querySelectorAll("[data-shopping-archive]").forEach((button) => button.addEventListener("click", async () => {
      const ok = await FM.ui.confirm({ title: "Arquivar lista", message: "A lista sairá das ativas, mas os itens e lançamentos vinculados serão preservados.", confirmLabel: "Arquivar" });
      if (ok) await run(FM.actions.archiveShoppingList(button.dataset.shoppingArchive));
    }));
  }

  function viewCompras() {
    let filter = "active";
    let query = "";
    const lists = FM.store.state.shoppingLists || [];
    const active = lists.filter((list) => list.status === "active");
    const sum = (items, key) => round2(items.reduce((total, list) => total + totals(list)[key], 0));
    const budget = round2(active.reduce((total, list) => total + num(list.budget), 0));
    const mount = document.querySelector("#view");
    mount.innerHTML = `<div class="view">
      <div class="page-heading"><div><span class="eyebrow">Rotina doméstica</span><h2>Compras domésticas</h2><p>Planeje os itens, controle o orçamento e registre a despesa uma única vez.</p></div><div class="content-actions"><button class="btn primary" data-new-shopping-list>${icon("plus")}Nova lista</button></div></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Listas ativas</span><span class="kpi-icon purple">${icon("receipt")}</span></div><div class="kpi-value">${active.length}</div><div class="kpi-foot">${lists.filter((list) => list.favorite && list.status !== "archived").length} favorita(s)</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Orçamento informado</span><span class="kpi-icon cyan">${icon("wallet")}</span></div><div class="kpi-value">${money(budget)}</div><div class="kpi-foot">Soma das listas ativas</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Total estimado</span><span class="kpi-icon amber">${icon("tag")}</span></div><div class="kpi-value">${money(sum(active, "estimated"))}</div><div class="kpi-foot">Todos os itens das listas ativas</div></div>
        <div class="kpi"><div class="kpi-head"><span class="kpi-label">Total comprado</span><span class="kpi-icon green">${icon("check-circle")}</span></div><div class="kpi-value pos">${money(sum(active, "effective"))}</div><div class="kpi-foot">Somente itens marcados como comprados</div></div>
      </div>
      <div class="card"><div class="card-body shopping-toolbar"><div class="tabs" role="tablist" aria-label="Filtrar listas">
        ${[["active", "Ativas"], ["favorites", "Favoritas"], ["completed", "Concluídas"], ["archived", "Arquivadas"], ["all", "Todas"]].map(([value, label]) => `<button class="tab ${filter === value ? "active" : ""}" data-shopping-filter="${value}" role="tab" aria-selected="${filter === value}">${label}</button>`).join("")}
      </div><label class="search-inline">${icon("search")}<input class="input" id="shopping-search" placeholder="Buscar lista ou item..." value="${esc(query)}"></label></div></div>
      <div id="shopping-list-results" class="shopping-grid mt-16"></div>
    </div>`;

    const results = mount.querySelector("#shopping-list-results");
    const paint = () => {
      const normalized = query.trim().toLowerCase();
      const filtered = lists.filter((list) => {
        const statusMatch = filter === "all" || (filter === "favorites" ? list.favorite && list.status !== "archived" : list.status === filter);
        const textMatch = !normalized || [list.name, ...(list.items || []).map((item) => item.name)].join(" ").toLowerCase().includes(normalized);
        return statusMatch && textMatch;
      });
      results.innerHTML = filtered.length ? filtered.map(listCard).join("") : FM.ui.emptyState("receipt", "Nenhuma lista encontrada", filter === "active" ? "Crie uma lista para planejar a próxima compra." : "Altere o filtro ou cadastre uma nova lista.", `<button class="btn primary mt-12" data-new-shopping-list>${icon("plus")}Nova lista</button>`);
      results.querySelectorAll("[data-new-shopping-list]").forEach((button) => button.addEventListener("click", () => openListForm(null)));
      bindCards(results);
    };
    mount.querySelector("[data-new-shopping-list]").addEventListener("click", () => openListForm(null));
    mount.querySelectorAll("[data-shopping-filter]").forEach((button) => button.addEventListener("click", () => {
      filter = button.dataset.shoppingFilter;
      mount.querySelectorAll("[data-shopping-filter]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      paint();
    }));
    mount.querySelector("#shopping-search").addEventListener("input", (event) => { query = event.target.value; paint(); });
    paint();
  }

  FM.views = FM.views || {};
  FM.views.compras = viewCompras;
})();

import test from "node:test";
import assert from "node:assert/strict";
import {
  accountBalance, annualSummary, cancelCardPurchase, cardInvoice, cardSummary, consolidatedBalance, createEmptyState,
  goalBalance, invoiceMonthForDate, moneyToCents, monthPlan, monthStats, missingOccurrences,
  generateRecurringOccurrences, nextOccurrenceDate, normalizeState, payCardInvoice, reverseInvoicePayment,
  saveCardPurchase, shoppingTotals, splitInstallments, validateState,
} from "../backend/src/services/finance.js";

function fixture() {
  const state = createEmptyState({ name: "Teste", email: "teste@example.com" });
  state.accounts = [
    { id: "ACC-1", name: "Conta", type: "Conta corrente", openingBalance: 1000, active: true },
    { id: "ACC-2", name: "Reserva", type: "Investimento", openingBalance: 0, active: true },
    { id: "CARD-1", name: "Cartão", type: "Cartão de crédito", openingBalance: 0, active: true, closingDay: 10, dueDay: 20, limit: 500 },
  ];
  state.categories.push({ id: "CAT-90", name: "Teste", subcategory: "Geral", type: "Despesa", description: "" });
  state.transactions = [
    { id: "TX-1", type: "receita", description: "Salário", amount: 2000, date: "2026-11-05", dueDate: "2026-11-05", account: "ACC-1", category: "Receitas", subcategory: "Entradas", section: "Entradas", payments: [{ id: "PAY-1", amount: 2000, date: "2026-11-05", account: "ACC-1" }] },
    { id: "TX-2", type: "despesa", description: "Mercado", amount: 300, date: "2026-11-06", dueDate: "2026-11-06", account: "ACC-1", category: "Teste", subcategory: "Geral", section: "Gastos do mês", payments: [{ id: "PAY-2", amount: 300, date: "2026-11-06", account: "ACC-1" }] },
    { id: "TX-3", type: "despesa", description: "Pendente", amount: 200, date: "2026-11-07", dueDate: "2026-11-30", account: "ACC-1", category: "Teste", subcategory: "Geral", section: "Contas fixas", payments: [] },
    { id: "TX-4", type: "despesa", description: "Compra cartão", amount: 120, date: "2026-11-08", dueDate: "2026-11-20", account: "CARD-1", category: "Teste", subcategory: "Geral", section: "Cartão de crédito", invoiceMonth: "2026-11", payments: [] },
  ];
  state.transfers = [{ id: "TR-1", fromAccount: "ACC-1", toAccount: "ACC-2", amount: 400, fee: 0, date: "2026-11-09" }];
  return state;
}

test("valores monetários são convertidos em centavos sem arredondamento flutuante", () => {
  assert.equal(moneyToCents("1.234,56"), 123456);
  assert.equal(moneyToCents(0.1) + moneyToCents(0.2), 30);
  assert.throws(() => moneyToCents("abc"));
});

test("parcelamento distribui o total exatamente até a última parcela", () => {
  const values = splitInstallments(100, 3);
  assert.deepEqual(values, [33.33, 33.33, 33.34]);
  assert.equal(values.reduce((sum, value) => sum + moneyToCents(value), 0), 10000);
});

test("saldo efetivo não inclui pendente e transferência não vira receita ou despesa", () => {
  const state = fixture();
  assert.equal(accountBalance(state, "ACC-1", "2026-11-30"), 2300);
  assert.equal(consolidatedBalance(state, "2026-11-30"), 2300);
  const stats = monthStats(state, "2026-11");
  assert.equal(stats.receitasRecebidas, 2000);
  assert.equal(stats.despesasPagas, 300);
  assert.equal(stats.saidasPrevistas, 200);
  assert.equal(monthPlan(state, "2026-11").despesas, 620);
});

test("cartão compromete limite e fatura sem reduzir caixa antes do pagamento", () => {
  const state = fixture();
  assert.equal(cardSummary(state, "CARD-1").used, 120);
  const invoice = cardInvoice(state, "CARD-1", "2026-11");
  assert.equal(invoice.total, 120);
  assert.equal(invoice.paid, 0);
  assert.equal(consolidatedBalance(state, "2026-11-08"), 2700);
  state.transfers.push({ id: "TR-2", fromAccount: "ACC-1", toAccount: "CARD-1", amount: 120, fee: 0, date: "2026-11-19", invoiceMonth: "2026-11" });
  assert.equal(cardInvoice(state, "CARD-1", "2026-11").status, "Paga");
  assert.equal(consolidatedBalance(state, "2026-11-19"), 2180);
});

test("data da compra define a fatura conforme o fechamento", () => {
  const card = { closingDay: 10, dueDay: 20 };
  assert.equal(invoiceMonthForDate(card, "2026-11-08"), "2026-11");
  assert.equal(invoiceMonthForDate(card, "2026-11-12"), "2026-12");
});

test("backup antigo normaliza cartão e calcula a fatura sem duplicar competência", () => {
  const state = fixture();
  delete state.accounts[2].closingDay;
  delete state.accounts[2].dueDay;
  delete state.accounts[2].limit;
  delete state.transactions[3].invoiceMonth;
  const normalized = normalizeState(state);
  assert.equal(normalized.accounts[2].closingDay, 31);
  assert.equal(normalized.accounts[2].dueDay, 31);
  assert.doesNotThrow(() => validateState(normalized));
  assert.equal(cardInvoice(normalized, "CARD-1", "2026-11").total, 120);

  const afterClosing = fixture();
  afterClosing.transactions[3].date = "2026-11-12";
  delete afterClosing.transactions[3].invoiceMonth;
  const migrated = normalizeState(afterClosing);
  assert.equal(migrated.transactions[3].invoiceMonth, "2026-12");
  assert.equal(cardInvoice(migrated, "CARD-1", "2026-11").total, 0);
  assert.equal(cardInvoice(migrated, "CARD-1", "2026-12").total, 120);
});

test("meta não permite saldo negativo sem regra explícita", () => {
  const state = fixture();
  state.goals = [{ id: "GOAL-1", name: "Viagem", account: "ACC-2", target: 1000, initialAmount: 100, startDate: "2026-11-01", movements: [{ id: "MOV-1", type: "retirada", amount: 150, date: "2026-11-10" }] }];
  assert.equal(goalBalance(state.goals[0]), -50);
  assert.throws(() => validateState(state), /saldo negativo/);
  state.goals[0].allowNegative = true;
  assert.doesNotThrow(() => validateState(state));
});

test("movimentos de meta refletem transferências sem virar despesa de consumo", () => {
  const state = fixture();
  state.goals = [{
    id: "GOAL-2", name: "Viagem", account: "ACC-2", initialAccount: "ACC-1",
    target: 1000, initialAmount: 400, startDate: "2026-11-09", status: "active", initialTransferId: "TR-1",
    movements: [
      { id: "MOV-2", type: "deposito", amount: 100, date: "2026-11-15", counterpartAccount: "ACC-1", transferId: "TR-2" },
      { id: "MOV-3", type: "retirada", amount: 50, date: "2026-11-16", counterpartAccount: "ACC-1", transferId: "TR-3" },
    ],
  }];
  state.transfers.push(
    { id: "TR-2", fromAccount: "ACC-1", toAccount: "ACC-2", amount: 100, fee: 0, date: "2026-11-15" },
    { id: "TR-3", fromAccount: "ACC-2", toAccount: "ACC-1", amount: 50, fee: 0, date: "2026-11-16" },
  );
  assert.doesNotThrow(() => validateState(state));
  assert.equal(goalBalance(state.goals[0]), 450);
  assert.equal(accountBalance(state, "ACC-1", "2026-11-30"), 2250);
  assert.equal(accountBalance(state, "ACC-2", "2026-11-30"), 450);
  assert.equal(monthStats(state, "2026-11").despesasPagas, 300);
  assert.equal(monthPlan(state, "2026-11").investimentos, 500);
});

test("meta vinculada exige transferência coerente e valor inicial não negativo", () => {
  const state = fixture();
  state.goals = [{
    id: "GOAL-3", name: "Reforma", account: "ACC-2", target: 2000, initialAmount: 100,
    startDate: "2026-11-01", status: "active", movements: [
      { id: "MOV-4", type: "deposito", amount: 100, date: "2026-11-10", counterpartAccount: "ACC-1", transferId: "TR-1" },
    ],
  }];
  assert.throws(() => validateState(state), /valor da transferência não confere/);
  state.goals[0].movements[0].amount = 400;
  state.goals[0].initialAmount = -1;
  assert.throws(() => validateState(state), /valor inicial inválido/);
});

test("totais da lista de compras usam centavos e somam apenas itens comprados no realizado", () => {
  const list = {
    items: [
      { quantity: 2, estimatedPrice: 3.29, effectivePrice: 3.19, purchased: true },
      { quantity: 3, estimatedPrice: 10.1, effectivePrice: 9.9, purchased: true },
      { quantity: 1, estimatedPrice: 7.5, effectivePrice: 6, purchased: false },
    ],
  };
  assert.deepEqual(shoppingTotals(list), { estimated: 44.38, effective: 36.08, purchased: 2, pending: 1 });
});

test("lista de compras rejeita itens inválidos e identificadores duplicados", () => {
  const state = fixture();
  state.shoppingLists = [{
    id: "SHOP-1", name: "Mercado", status: "active", budget: 200, favorite: false, generatedTxIds: [],
    items: [
      { id: "ITEM-1", name: "Arroz", quantity: 2, unit: "kg", category: "Alimentação", estimatedPrice: 8.9, effectivePrice: 0, purchased: false },
      { id: "ITEM-2", name: "Leite", quantity: 1, unit: "L", category: "Alimentação", estimatedPrice: 6, effectivePrice: 0, purchased: false },
    ],
  }];
  assert.doesNotThrow(() => validateState(state));
  state.shoppingLists[0].items[0].quantity = 0;
  assert.throws(() => validateState(state), /quantidade deve ser positiva/);
  state.shoppingLists[0].items[0].quantity = 2;
  state.shoppingLists[0].items[1].id = "ITEM-1";
  assert.throws(() => validateState(state), /Item de compra duplicado/);
});

test("despesa de compra exige vínculo recíproco e lista concluída", () => {
  const state = fixture();
  state.shoppingLists = [{
    id: "SHOP-1", name: "Mercado", status: "completed", budget: 200, favorite: false,
    generatedTxIds: ["TX-SHOP"],
    items: [{ id: "ITEM-1", name: "Arroz", quantity: 2, unit: "kg", category: "Alimentação", estimatedPrice: 8.9, effectivePrice: 8.5, purchased: true }],
  }];
  state.transactions.push({
    ...state.transactions[1], id: "TX-SHOP", amount: 17, description: "Mercado",
    shoppingListId: "SHOP-1", shoppingItemIds: ["ITEM-1"], payments: [{ id: "PAY-SHOP", amount: 17, date: "2026-11-27", account: "ACC-1" }],
  });
  assert.doesNotThrow(() => validateState(state));
  state.shoppingLists[0].status = "active";
  assert.throws(() => validateState(state), /conclua a lista/);
  state.shoppingLists[0].status = "completed";
  state.shoppingLists[0].generatedTxIds = [];
  assert.throws(() => validateState(state), /vínculo de compra inválido/);
  state.shoppingLists[0].generatedTxIds = ["TX-SHOP", "TX-SHOP"];
  assert.throws(() => validateState(state), /lançamento de compra duplicado/);
});

test("recorrência não repete ocorrências já registradas", () => {
  const rule = { id: "REC-1", description: "Internet", frequency: "monthly", startDate: "2026-09-10", active: true, occurrenceKeys: ["REC-1:2026-09-10", "REC-1:2026-10-10"] };
  assert.deepEqual(missingOccurrences(rule, "2026-12-10").map((item) => item.date), ["2026-11-10", "2026-12-10"]);
  assert.deepEqual(missingOccurrences({ ...rule, active: false }, "2026-12-10"), []);
});

function recurringFixture(reviewBeforeGenerate = false) {
  const state = fixture();
  state.recurring = [{
    id: "REC-1", description: "Internet", type: "despesa", amount: 99.9,
    category: "Teste", subcategory: "Geral", section: "Contas fixas", account: "ACC-1",
    method: "PIX", costCenter: "", frequency: "monthly", intervalDays: null,
    startDate: "2026-09-10", endDate: null, status: "active", active: true,
    reviewBeforeGenerate, note: "", occurrenceKeys: [],
  }];
  return state;
}

test("geração recorrente cria previsões únicas sem baixar o caixa", () => {
  const state = recurringFixture();
  const result = generateRecurringOccurrences(state, "REC-1", "2026-11-10");
  assert.equal(result.created.length, 3);
  assert.deepEqual(result.created.map((tx) => tx.date), ["2026-09-10", "2026-10-10", "2026-11-10"]);
  assert.ok(result.created.every((tx) => tx.status === "Previsto" && tx.payments.length === 0));
  assert.equal(new Set(result.created.map((tx) => tx.id)).size, 3);
  assert.equal(result.state.recurring[0].occurrenceKeys.length, 3);
  assert.equal(result.state.recurring[0].nextOccurrence, "2026-12-10");
  assert.equal(accountBalance(result.state, "ACC-1", "2026-11-30"), 2300);
  assert.equal(generateRecurringOccurrences(result.state, "REC-1", "2026-11-10").created.length, 0);
});

test("revisão recorrente exige seleção válida e impede repetição", () => {
  const state = recurringFixture(true);
  assert.throws(() => generateRecurringOccurrences(state, "REC-1", "2026-11-10"), /Revise as ocorrências/);
  assert.throws(() => generateRecurringOccurrences(state, "REC-1", "2026-11-10", []), /ao menos uma/);
  assert.throws(() => generateRecurringOccurrences(state, "REC-1", "2026-11-10", ["REC-1:2026-12-10"]), /não está mais pendente/);
  assert.throws(() => generateRecurringOccurrences(state, "REC-1", "2026-11-10", ["REC-1:2026-10-10", "REC-1:2026-10-10"]), /mais de uma vez/);
  const result = generateRecurringOccurrences(state, "REC-1", "2026-11-10", ["REC-1:2026-10-10"]);
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].date, "2026-10-10");
  assert.throws(() => generateRecurringOccurrences(result.state, "REC-1", "2026-11-10", ["REC-1:2026-10-10"]), /não está mais pendente/);
});

test("recorrência pausa, encerra e mantém vínculo recíproco com lançamentos", () => {
  const state = recurringFixture();
  state.recurring[0].status = "paused";
  state.recurring[0].active = false;
  assert.equal(nextOccurrenceDate(state.recurring[0], "2026-09-01"), null);
  assert.throws(() => generateRecurringOccurrences(state, "REC-1", "2026-11-10"), /Retome a recorrência/);
  state.recurring[0].status = "active";
  state.recurring[0].active = true;
  state.recurring[0].endDate = "2026-10-10";
  assert.equal(nextOccurrenceDate(state.recurring[0], "2026-11-01"), null);
  state.recurring[0].endDate = null;
  const result = generateRecurringOccurrences(state, "REC-1", "2026-09-10");
  const invalid = JSON.parse(JSON.stringify(result.state));
  invalid.transactions = invalid.transactions.filter((tx) => tx.occurrenceKey !== "REC-1:2026-09-10");
  assert.throws(() => validateState(invalid), /ocorrência sem lançamento/);
  const other = JSON.parse(JSON.stringify(result.state));
  other.transactions.find((tx) => tx.recurrenceId).occurrenceKey = "REC-1:2026-09-11";
  assert.throws(() => validateState(other), /chave da ocorrência inválida/);
});

test("lembretes validam data, conclusão e vínculos opcionais", () => {
  const state = fixture();
  state.reminders = [{
    id: "REM-1", title: "Pagar cartão", type: "financial", priority: "high",
    remindAt: "2026-11-20T09:00:00.000Z", completed: false, completedAt: null,
    linkType: "transaction", linkId: "TX-1", note: "Conferir valor",
  }];
  assert.doesNotThrow(() => validateState(state));
  state.reminders[0].completed = true;
  state.reminders[0].completedAt = "2026-11-19T12:00:00.000Z";
  assert.doesNotThrow(() => validateState(state));
  state.reminders[0].linkId = "TX-NOT-FOUND";
  assert.throws(() => validateState(state), /movimentação vinculada não encontrada/);
  state.reminders[0].linkType = "";
  state.reminders[0].linkId = "";
  state.reminders[0].remindAt = "data inválida";
  assert.throws(() => validateState(state), /data e hora inválida/);
});

test("validação rejeita baixa duplicada e transferência para a mesma conta", () => {
  const state = fixture();
  state.transactions[0].payments.push({ ...state.transactions[0].payments[0] });
  assert.throws(() => validateState(state), /Baixa duplicada/);
  const other = fixture();
  other.transfers[0].toAccount = "ACC-1";
  assert.throws(() => validateState(other), /origem e destino/);
});

test("resumo anual preserva meses vazios sem inventar movimentações", () => {
  const state = fixture();
  const months = annualSummary(state, 2026);
  assert.equal(months.length, 12);
  assert.equal(months[0].movimentado, false);
  assert.equal(months[0].receitas, 0);
  assert.equal(months[10].movimentado, true);
});

test("backup local é normalizado para a nova versão sem perder lançamentos", () => {
  const state = fixture();
  state.meta.org = "Livis Finance";
  delete state.goals;
  const normalized = normalizeState(state);
  assert.equal(normalized.meta.org, "Meu Lar Financeiro");
  assert.deepEqual(normalized.goals, []);
  assert.equal(normalized.transactions.length, 4);
});

test("categorias legadas são migradas sem alterar valores ou lançamentos", () => {
  const state = fixture();
  state.categories = [{ id: "CAT-OLD", name: "Mercado", subcategory: "Geral", type: "Despesa", description: "Categoria antiga" }];
  state.transactions.forEach((tx) => {
    if (tx.type !== "receita") {
      tx.category = "Mercado";
      tx.subcategory = "Geral";
    }
  });
  const normalized = normalizeState(state);
  assert.equal(normalized.transactions.length, 4);
  assert.equal(normalized.transactions[1].category, "Alimentação");
  assert.equal(normalized.transactions[1].subcategory, "Mercado e restaurantes");
  assert.ok(normalized.categories.some((category) => category.name === "Alimentação"));
});

test("compra de cartão importada vira obrigação de fatura sem baixa duplicada", () => {
  const state = fixture();
  state.transactions[3].sourceRef = "Novembro · Cartão";
  state.transactions[3].payments = [{ id: "PAY-CARD", amount: 120, date: "2026-11-08", account: "CARD-1" }];
  const normalized = normalizeState(state);
  assert.deepEqual(normalized.transactions[3].payments, []);
  assert.equal(normalized.transactions[3].dueDate, "2026-11-20");
  assert.equal(cardSummary(normalized, "CARD-1").used, 120);
  assert.equal(consolidatedBalance(normalized, "2026-11-30"), 2300);
});

const purchaseData = {
  description: "Eletrônico", account: "CARD-1", date: "2026-11-08", total: 100,
  installments: 3, category: "Teste", subcategory: "Geral", costCenter: "", note: "",
};

test("compra parcelada cria identificadores únicos e faturas consecutivas com soma exata", () => {
  const result = saveCardPurchase(fixture(), purchaseData);
  const items = result.transactions;
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map((item) => item.id)).size, 3);
  assert.deepEqual(items.map((item) => item.invoiceMonth), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(items.map((item) => item.amount), [33.33, 33.33, 33.34]);
  assert.equal(items.reduce((sum, item) => sum + moneyToCents(item.amount), 0), 10000);
  assert.equal(cardInvoice(result.state, "CARD-1", "2027-01").total, 33.34);
});

test("compra acima do limite configurado é rejeitada", () => {
  assert.throws(() => saveCardPurchase(fixture(), { ...purchaseData, total: 381, installments: 1 }), /limite/);
});

test("pagamento de fatura aceita valor parcial e rejeita excesso", () => {
  const partial = payCardInvoice(fixture(), "CARD-1", "2026-11", { amount: 40, date: "2026-11-19", fromAccount: "ACC-1" });
  assert.equal(cardInvoice(partial.state, "CARD-1", "2026-11").status, "Parcial");
  assert.equal(cardInvoice(partial.state, "CARD-1", "2026-11").balance, 80);
  assert.throws(() => payCardInvoice(partial.state, "CARD-1", "2026-11", { amount: 81, date: "2026-11-19", fromAccount: "ACC-1" }), /excede o saldo/);
});

test("fatura exige competência e compra de cartão não aceita baixa direta", () => {
  const withoutMonth = fixture();
  withoutMonth.transfers.push({ id: "TR-2", fromAccount: "ACC-1", toAccount: "CARD-1", amount: 120, fee: 0, date: "2026-11-19" });
  assert.throws(() => validateState(withoutMonth), /mês da fatura/);

  const directPayment = fixture();
  directPayment.transactions[3].payments = [{ id: "PAY-CARD", amount: 120, date: "2026-11-19", account: "ACC-1" }];
  assert.throws(() => validateState(directPayment), /cartão.*pagamento|pagamento.*cartão/);
});

test("edição da compra realoca parcelas ao mudar data e cartão", () => {
  const created = saveCardPurchase(fixture(), purchaseData);
  created.state.accounts.push({ id: "CARD-2", name: "Outro cartão", type: "Cartão de crédito", openingBalance: 0, active: true, closingDay: 20, dueDay: 28, limit: 1000 });
  const edited = saveCardPurchase(created.state, { ...purchaseData, account: "CARD-2", date: "2026-11-25", installments: 2, total: 90 }, created.purchaseId);
  assert.equal(edited.transactions.length, 2);
  assert.ok(edited.transactions.every((item) => item.account === "CARD-2" && item.purchaseDate === "2026-11-25"));
  assert.deepEqual(edited.transactions.map((item) => item.invoiceMonth), ["2026-12", "2027-01"]);
  assert.equal(cardInvoice(edited.state, "CARD-1", "2026-11").total, 120);
  assert.equal(cardInvoice(edited.state, "CARD-2", "2026-12").total, 45);
});

test("cancelamento exige estorno prévio e preserva todas as parcelas", () => {
  const created = saveCardPurchase(fixture(), purchaseData);
  const paid = payCardInvoice(created.state, "CARD-1", "2026-11", { amount: 33.33, date: "2026-11-19", fromAccount: "ACC-1" });
  assert.throws(() => cancelCardPurchase(paid.state, created.purchaseId, "Estorno da loja"), /Estorne os pagamentos/);
  const reversed = reverseInvoicePayment(paid.state, paid.transfer.id);
  const cancelled = cancelCardPurchase(reversed.state, created.purchaseId, "Estorno da loja");
  assert.ok(cancelled.transactions.every((item) => item.cancelled && item.status === "Cancelado"));
  assert.equal(cardInvoice(cancelled.state, "CARD-1", "2026-11").total, 120);
  assert.equal(cardInvoice(cancelled.state, "CARD-1", "2026-12").total, 0);
});

test("ofertante vinculado aparece no resumo anual e bloqueia exclusão em uso", () => {
  const state = fixture();
  state.donors.push({ id: "DOA-001", name: "Maria", contact: "", note: "", active: true });
  state.transactions[0].donorId = "DOA-001";
  assert.doesNotThrow(() => validateState(state));
  assert.deepEqual(annualSummary(state, 2026)[10].ofertantes, [{ id: "DOA-001", name: "Maria" }]);
  state.donors = [];
  assert.throws(() => validateState(state), /ofertante/);
});

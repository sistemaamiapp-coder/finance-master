process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../backend/src/app.js";
import { MemoryRepository } from "../backend/src/repositories/memory.js";
import { createEmptyState } from "../backend/src/services/finance.js";

const credentials = { name: "Maria", email: "maria@example.com", password: "Segura1234" };

async function setup(overrides = {}, repository = new MemoryRepository()) {
  const app = createApp({ repository });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({ ...credentials, ...overrides }).expect(201);
  return { app, repository, agent, csrf: response.body.csrfToken, user: response.body.user };
}

test("cadastro cria sessão segura e workspace vazio", async () => {
  const { agent, user } = await setup();
  assert.equal(user.name, "Maria");
  const me = await agent.get("/api/auth/me").expect(200);
  assert.equal(me.body.user.email, credentials.email);
  const workspace = await agent.get("/api/state").expect(200);
  assert.equal(workspace.body.revision, 0);
  assert.equal(workspace.body.state.transactions.length, 0);
  assert.equal(workspace.body.state.accounts.length, 0);
});

test("rotas financeiras exigem autenticação", async () => {
  const app = createApp({ repository: new MemoryRepository() });
  await request(app).get("/api/state").expect(401);
  await request(app).get("/api/backup").expect(401);
});

test("gravação exige CSRF e revisão correta", async () => {
  const { agent, csrf } = await setup();
  const state = createEmptyState({ name: "Maria" });
  await agent.put("/api/state").send({ state, expectedRevision: 0 }).expect(403);
  await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state, expectedRevision: 1 }).expect(409);
  const saved = await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state, expectedRevision: 0 }).expect(200);
  assert.equal(saved.body.revision, 1);
});

test("backend rejeita estado financeiro inconsistente", async () => {
  const { agent, csrf } = await setup();
  const state = createEmptyState({ name: "Maria" });
  state.accounts = [{ id: "ACC-1", name: "Conta", type: "Conta corrente", openingBalance: 0 }];
  state.transactions = [{ id: "TX-1", type: "despesa", description: "Teste", amount: 10, date: "2026-11-01", dueDate: "2026-11-01", account: "ACC-1", category: "Outros", subcategory: "Despesas diversas", section: "Gastos do mês", payments: [{ id: "PAY-1", amount: 20, date: "2026-11-01", account: "ACC-1" }] }];
  const response = await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state, expectedRevision: 0 }).expect(422);
  assert.match(response.body.error, /baixas superam/);
});

test("login, logout e backup funcionam com a mesma sessão", async () => {
  const { agent, csrf } = await setup();
  await agent.post("/api/auth/logout").set("X-CSRF-Token", csrf).send({}).expect(200);
  await agent.get("/api/state").expect(401);
  const login = await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password }).expect(200);
  const backup = await agent.get("/api/backup").expect(200);
  assert.equal(backup.body.product, "Meu Lar Financeiro");
  assert.equal(login.body.user.email, credentials.email);
});

test("relatório anual usa dados reais do workspace", async () => {
  const { agent, csrf } = await setup();
  const state = createEmptyState({ name: "Maria" });
  state.accounts = [{ id: "ACC-1", name: "Conta", type: "Conta corrente", openingBalance: 0 }];
  state.transactions = [{ id: "TX-1", type: "receita", description: "Entrada", amount: 500, date: "2026-11-05", dueDate: "2026-11-05", account: "ACC-1", category: "Receitas", subcategory: "Entradas", section: "Entradas", payments: [{ id: "PAY-1", amount: 500, date: "2026-11-05", account: "ACC-1" }] }];
  await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state, expectedRevision: 0 }).expect(200);
  const report = await agent.get("/api/reports/annual/2026").expect(200);
  assert.equal(report.body.months[10].recebido, 500);
  assert.equal(report.body.months[0].recebido, 0);
});

test("troca de senha invalida a credencial anterior", async () => {
  const { agent, csrf } = await setup();
  await agent.post("/api/auth/password").set("X-CSRF-Token", csrf).send({ currentPassword: credentials.password, newPassword: "NovaSenha123" }).expect(200);
  await agent.post("/api/auth/logout").set("X-CSRF-Token", csrf).send({}).expect(200);
  await agent.post("/api/auth/login").send({ email: credentials.email, password: credentials.password }).expect(401);
  const login = await agent.post("/api/auth/login").send({ email: credentials.email, password: "NovaSenha123" }).expect(200);
  assert.equal(login.body.user.email, credentials.email);
});

test("workspaces de usuárias diferentes permanecem isolados", async () => {
  const repository = new MemoryRepository();
  const first = await setup({}, repository);
  const second = await setup({ name: "Ana", email: "ana@example.com" }, repository);
  const state = createEmptyState({ name: "Maria" });
  state.accounts = [{ id: "ACC-1", name: "Conta principal", type: "Conta corrente", openingBalance: 100 }];
  await first.agent.put("/api/state").set("X-CSRF-Token", first.csrf).send({ state, expectedRevision: 0 }).expect(200);
  const isolated = await second.agent.get("/api/state").expect(200);
  assert.equal(isolated.body.state.accounts.length, 0);
  assert.equal(isolated.body.revision, 0);
});

test("perfil atualizado exige CSRF e altera a identidade autenticada", async () => {
  const { agent, csrf } = await setup();
  await agent.put("/api/auth/profile").send({ name: "Maria Silva" }).expect(403);
  const response = await agent.put("/api/auth/profile").set("X-CSRF-Token", csrf).send({ name: "Maria Silva" }).expect(200);
  assert.equal(response.body.user.name, "Maria Silva");
  const me = await agent.get("/api/auth/me").expect(200);
  assert.equal(me.body.user.name, "Maria Silva");
});

test("troca de senha preserva a sessão atual e revoga as demais", async () => {
  const { app, agent, csrf } = await setup();
  const other = request.agent(app);
  await other.post("/api/auth/login").send({ email: credentials.email, password: credentials.password }).expect(200);
  await agent.post("/api/auth/password").set("X-CSRF-Token", csrf).send({ currentPassword: credentials.password, newPassword: "NovaSenha123" }).expect(200);
  await agent.get("/api/state").expect(200);
  await other.get("/api/state").expect(401);
});

test("exclusão da conta remove sessões e bloqueia novo login", async () => {
  const { app, agent, csrf } = await setup();
  await agent.delete("/api/auth/account").send({}).expect(403);
  await agent.delete("/api/auth/account").set("X-CSRF-Token", csrf).send({}).expect(200);
  await agent.get("/api/state").expect(401);
  await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password }).expect(401);
});

test("exclusão da conta exige sessão recente", async () => {
  const { repository, agent, csrf } = await setup();
  repository.sessions.forEach((session) => { session.createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); });
  const response = await agent.delete("/api/auth/account").set("X-CSRF-Token", csrf).send({}).expect(403);
  assert.equal(response.body.code, "REAUTH_REQUIRED");
});

test("preferências de tema e notificações são validadas no workspace", async () => {
  const { agent, csrf } = await setup();
  const state = createEmptyState({ name: "Maria" });
  state.settings.theme = "dark";
  state.settings.notifications = { dueDays: 14, budgetWarning: 75, budgetCritical: 120, goalInactivityDays: 45 };
  const saved = await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state, expectedRevision: 0 }).expect(200);
  assert.equal(saved.body.state.settings.theme, "dark");
  assert.deepEqual(saved.body.state.settings.notifications, state.settings.notifications);
  const invalid = createEmptyState({ name: "Maria" });
  invalid.settings.notifications.budgetCritical = 70;
  await agent.put("/api/state").set("X-CSRF-Token", csrf).send({ state: invalid, expectedRevision: 1 }).expect(422);
});

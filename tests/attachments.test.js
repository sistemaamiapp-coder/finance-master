process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../backend/src/app.js";
import { MemoryRepository } from "../backend/src/repositories/memory.js";
import { createEmptyState } from "../backend/src/services/finance.js";
import { FileAttachmentStorage, MAX_ATTACHMENT_BYTES } from "../backend/src/services/attachments.js";
import { mountPublicFiles } from "../backend/src/server.js";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = Buffer.from("RIFF0000WEBP", "ascii");
const pdf = Buffer.from("%PDF-1.7\n%%EOF");

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "meu-lar-attachments-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new MemoryRepository();
  const app = createApp({ repository, attachmentStorage: new FileAttachmentStorage(directory) });
  const register = async (name, email) => {
    const agent = request.agent(app);
    const response = await agent.post("/api/auth/register").send({ name, email, password: "Segura1234" }).expect(201);
    const state = createEmptyState({ name });
    state.accounts = [{ id: "ACC-1", name: "Conta principal", type: "Conta corrente", openingBalance: 0 }, { id: "CARD-1", name: "Cartão", type: "Cartão de crédito", openingBalance: 0 }];
    state.transactions = [
      { id: "TX-1", type: "despesa", description: "Mercado", amount: 10, date: "2026-11-05", dueDate: "2026-11-05", account: "ACC-1", category: "Alimentação", subcategory: "Mercado", section: "Gastos do mês", payments: [] },
      { id: "TX-CARD", cardPurchaseId: "PUR-1", type: "despesa", description: "Compra", amount: 20, date: "2026-11-06", dueDate: "2026-11-06", account: "CARD-1", category: "Outros", subcategory: "Diversos", section: "Cartão de crédito", payments: [] },
    ];
    await repository.saveWorkspace(response.body.user.id, state, 0);
    return { agent, csrf: response.body.csrfToken, user: response.body.user };
  };
  return { app, repository, directory, first: await register("Maria", "maria@example.com"), second: await register("Ana", "ana@example.com") };
}

function upload(context, entityType = "transaction", entityId = "TX-1", content = png, mimeType = "image/png", filename = "comprovante.png") {
  return context.first.agent.post(`/api/attachments/upload/${entityType}/${entityId}`)
    .set("X-CSRF-Token", context.first.csrf)
    .set("Content-Type", mimeType)
    .set("X-File-Name", encodeURIComponent(filename))
    .send(content);
}

test("formatos válidos são armazenados com metadados públicos e download privado", async (t) => {
  const context = await fixture(t);
  for (const [content, mimeType, filename] of [[png, "image/png", "nota.png"], [jpeg, "image/jpeg", "foto.jpg"], [webp, "image/webp", "foto.webp"], [pdf, "application/pdf", "boleto.pdf"]]) {
    const response = await upload(context, "transaction", "TX-1", content, mimeType, filename).expect(201);
    assert.equal(response.body.attachment.mimeType, mimeType);
    assert.equal(response.body.attachment.filename, filename);
    assert.equal(response.body.attachment.storageKey, undefined);
    assert.equal(response.body.attachment.storage_key, undefined);
    const download = await context.first.agent.get(`/api/attachments/content/${response.body.attachment.id}`).expect(200);
    assert.deepEqual(download.body, content);
    assert.equal(download.headers["content-type"], mimeType);
    assert.equal(download.headers["x-content-type-options"], "nosniff");
    assert.match(download.headers["content-security-policy"], /sandbox/);
    assert.match(download.headers["content-disposition"], /^attachment;/);
  }
  const list = await context.first.agent.get("/api/attachments/transaction/TX-1").expect(200);
  assert.equal(list.body.attachments.length, 4);
  assert.ok(list.body.attachments.every((item) => !("storageKey" in item) && !("storage_key" in item)));
  const backup = await context.first.agent.get("/api/backup").expect(200);
  assert.equal(JSON.stringify(backup.body).includes("storage"), false);
});

test("upload e remoção exigem sessão e CSRF", async (t) => {
  const context = await fixture(t);
  await request(context.app).post("/api/attachments/upload/transaction/TX-1").set("Content-Type", "image/png").send(png).expect(401);
  await context.first.agent.post("/api/attachments/upload/transaction/TX-1").set("Content-Type", "image/png").set("X-File-Name", "nota.png").send(png).expect(403);
  const response = await upload(context).expect(201);
  await context.first.agent.delete(`/api/attachments/${response.body.attachment.id}`).send({}).expect(403);
  await context.first.agent.delete(`/api/attachments/${response.body.attachment.id}`).set("X-CSRF-Token", context.first.csrf).send({}).expect(200);
  await context.first.agent.get(`/api/attachments/content/${response.body.attachment.id}`).expect(404);
});

test("contas, compras de cartão e faturas aceitam comprovantes vinculados", async (t) => {
  const context = await fixture(t);
  for (const [entityType, entityId] of [["account", "ACC-1"], ["card_purchase", "PUR-1"], ["invoice", "CARD-1:2026-11"]]) {
    const created = await upload(context, entityType, entityId).expect(201);
    assert.equal(created.body.attachment.entityType, entityType);
    assert.equal(created.body.attachment.entityId, entityId);
    const list = await context.first.agent.get(`/api/attachments/${entityType}/${entityId}`).expect(200);
    assert.equal(list.body.attachments.length, 1);
  }
});

test("conteúdo inválido, MIME falsificado e arquivo acima do limite são rejeitados", async (t) => {
  const context = await fixture(t);
  const invalid = await upload(context, "transaction", "TX-1", Buffer.from("texto"), "image/png").expect(422);
  assert.match(invalid.body.error, /Formato não permitido/);
  const mismatch = await upload(context, "transaction", "TX-1", png, "application/pdf").expect(422);
  assert.match(mismatch.body.error, /não corresponde/);
  const large = await upload(context, "transaction", "TX-1", Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 1), "application/octet-stream").expect(413);
  assert.equal(large.body.code, "ATTACHMENT_TOO_LARGE");
  assert.equal((await context.first.agent.get("/api/attachments/transaction/TX-1").expect(200)).body.attachments.length, 0);
});

test("vinculo inexistente e tipo de entidade inválido não recebem arquivos", async (t) => {
  const context = await fixture(t);
  const missing = await upload(context, "transaction", "TX-999").expect(404);
  assert.equal(missing.body.code, "ATTACHMENT_ENTITY_NOT_FOUND");
  await upload(context, "unknown", "TX-1").expect(422);
  await upload(context, "invoice", "ACC-1:2026-13").expect(404);
});

test("outra usuária não lista, baixa nem remove comprovantes", async (t) => {
  const context = await fixture(t);
  const created = await upload(context).expect(201);
  const id = created.body.attachment.id;
  const isolated = await context.second.agent.get("/api/attachments/transaction/TX-1").expect(200);
  assert.equal(isolated.body.attachments.length, 0);
  await context.second.agent.get(`/api/attachments/content/${id}`).expect(404);
  await context.second.agent.delete(`/api/attachments/${id}`).set("X-CSRF-Token", context.second.csrf).send({}).expect(404);
  const list = await context.first.agent.get("/api/attachments/transaction/TX-1").expect(200);
  assert.equal(list.body.attachments.length, 1);
});

test("nome do arquivo remove diretórios e caracteres de controle", async (t) => {
  const context = await fixture(t);
  const response = await upload(context, "transaction", "TX-1", png, "image/png", "../../nota\u0000.png").expect(201);
  assert.equal(response.body.attachment.filename, "nota.png");
});

test("exclusão da conta apaga metadados e arquivos privados", async (t) => {
  const context = await fixture(t);
  const created = await upload(context).expect(201);
  await context.first.agent.delete("/api/auth/account").set("X-CSRF-Token", context.first.csrf).send({}).expect(200);
  assert.equal(context.repository.attachments.size, 0);
  assert.deepEqual(await readdir(path.join(context.directory, context.first.user.id)), []);
  await context.second.agent.get(`/api/attachments/content/${created.body.attachment.id}`).expect(404);
});

test("servidor público não expõe backend, testes ou arquivos privados", async () => {
  const app = createApp({ repository: new MemoryRepository() });
  mountPublicFiles(app);
  await request(app).get("/").expect(200);
  await request(app).get("/assets/js/app.js").expect(200);
  await request(app).get("/backend/src/services/finance.js").expect(200);
  await request(app).get("/backend/src/app.js").expect(404);
  await request(app).get("/tests/api.test.js").expect(404);
  await request(app).get("/.env").expect(404);
  await request(app).get("/package.json").expect(404);
});

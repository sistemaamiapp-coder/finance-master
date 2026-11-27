import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError, ValidationError } from "./errors.js";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = Object.freeze(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ENTITY_TYPES = new Set(["transaction", "card_purchase", "invoice", "account"]);
const EXTENSIONS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function detectMime(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function safeFilename(value) {
  let decoded = value || "comprovante";
  try { decoded = decodeURIComponent(decoded); } catch { throw new ValidationError("Nome do arquivo inválido."); }
  const filename = decoded.replace(/\\/g, "/").split("/").pop().replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
  if (!filename) throw new ValidationError("Informe um nome válido para o arquivo.");
  return filename;
}

export class FileAttachmentStorage {
  constructor(root = path.join(os.homedir(), ".meu-lar-financeiro", "attachments")) {
    this.root = path.resolve(root);
  }

  resolve(key) {
    if (typeof key !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:pdf|jpg|png|webp)$/i.test(key)) {
      throw new AppError("Arquivo privado inválido.", 404, "ATTACHMENT_NOT_FOUND");
    }
    const target = path.resolve(this.root, key);
    if (path.dirname(target) !== path.join(this.root, key.split("/")[0])) throw new AppError("Arquivo privado inválido.", 404, "ATTACHMENT_NOT_FOUND");
    return target;
  }

  keyFor(userId, mimeType) {
    return `${userId}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
  }

  async put(key, content) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, content, { flag: "wx", mode: 0o600 });
  }

  async get(key) {
    return readFile(this.resolve(key));
  }

  async delete(key) {
    try { await unlink(this.resolve(key)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function publicAttachment(record) {
  return {
    id: record.id,
    entityType: record.entity_type || record.entityType,
    entityId: record.entity_id || record.entityId,
    filename: record.filename,
    mimeType: record.mime_type || record.mimeType,
    sizeBytes: Number(record.size_bytes ?? record.sizeBytes),
    createdAt: record.created_at || record.createdAt,
  };
}

export class AttachmentService {
  constructor(repository, storage = new FileAttachmentStorage()) {
    this.repository = repository;
    this.storage = storage;
  }

  async assertEntity(userId, entityType, entityId) {
    if (!ENTITY_TYPES.has(entityType) || typeof entityId !== "string" || !entityId || entityId.length > 180 || !/^[A-Za-z0-9_.:-]+$/.test(entityId)) {
      throw new ValidationError("Vínculo do comprovante inválido.");
    }
    const workspace = await this.repository.getWorkspace(userId);
    const state = workspace?.state;
    let exists = false;
    if (entityType === "transaction") exists = !!state?.transactions?.some((tx) => tx.id === entityId);
    if (entityType === "account") exists = !!state?.accounts?.some((account) => account.id === entityId);
    if (entityType === "card_purchase") exists = !!state?.transactions?.some((tx) => tx.cardPurchaseId === entityId);
    if (entityType === "invoice") {
      const [cardId, month] = entityId.split(":");
      exists = !!state?.accounts?.some((account) => account.id === cardId && account.type === "Cartão de crédito") && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month || "");
    }
    if (!exists) throw new AppError("O registro vinculado não foi encontrado.", 404, "ATTACHMENT_ENTITY_NOT_FOUND");
  }

  async upload(userId, entityType, entityId, content, declaredType, filename) {
    await this.assertEntity(userId, entityType, entityId);
    if (!Buffer.isBuffer(content) || !content.length) throw new ValidationError("O arquivo está vazio.");
    if (content.length > MAX_ATTACHMENT_BYTES) throw new AppError("Cada comprovante deve ter no máximo 5 MiB.", 413, "ATTACHMENT_TOO_LARGE");
    const mimeType = detectMime(content);
    if (!mimeType) throw new ValidationError("Formato não permitido. Envie PDF, JPEG, PNG ou WebP.");
    if (declaredType && declaredType !== mimeType) throw new ValidationError("O tipo informado não corresponde ao conteúdo do arquivo.");
    const key = this.storage.keyFor(userId, mimeType);
    try {
      await this.storage.put(key, content);
      const record = await this.repository.createAttachment({ userId, entityType, entityId, filename: safeFilename(filename), mimeType, sizeBytes: content.length, storageKey: key });
      return publicAttachment(record);
    } catch (error) {
      await this.storage.delete(key).catch(() => {});
      throw error;
    }
  }

  async list(userId, entityType, entityId) {
    await this.assertEntity(userId, entityType, entityId);
    return (await this.repository.listAttachments(userId, entityType, entityId)).map(publicAttachment);
  }

  async download(userId, attachmentId) {
    const record = await this.repository.findAttachment(userId, attachmentId);
    if (!record) throw new AppError("Comprovante não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    try {
      return { content: await this.storage.get(record.storage_key || record.storageKey), attachment: publicAttachment(record) };
    } catch (error) {
      if (error.code === "ENOENT") throw new AppError("O arquivo deste comprovante não está mais disponível.", 404, "ATTACHMENT_NOT_FOUND");
      throw error;
    }
  }

  async remove(userId, attachmentId) {
    const record = await this.repository.findAttachment(userId, attachmentId);
    if (!record) throw new AppError("Comprovante não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    await this.repository.deleteAttachment(userId, attachmentId);
    await this.storage.delete(record.storage_key || record.storageKey);
  }

  async removeUserFiles(userId) {
    const records = await this.repository.listAllAttachments(userId);
    for (const record of records) await this.storage.delete(record.storage_key || record.storageKey);
  }
}

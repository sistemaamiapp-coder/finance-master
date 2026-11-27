import { createEmptyState } from "../services/finance.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export class MemoryRepository {
  users = new Map();
  sessions = new Map();
  workspaces = new Map();
  attachments = new Map();

  async createUser(user) {
    const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...user };
    this.users.set(record.id, clone(record));
    this.workspaces.set(record.id, { state: createEmptyState(record), revision: 0 });
    return clone(record);
  }

  async findUserByEmail(email) {
    return clone([...this.users.values()].find((user) => user.email === email) || null);
  }

  async findUserById(id) {
    return clone(this.users.get(id) || null);
  }

  async updatePassword(id, passwordHash) {
    const user = this.users.get(id);
    if (!user) throw new Error("Usuária não encontrada.");
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
  }

  async updateProfile(id, name) {
    const user = this.users.get(id);
    if (!user) throw new Error("Usuária não encontrada.");
    user.name = name;
    user.updatedAt = new Date().toISOString();
    return clone(user);
  }

  async createSession(session) {
    const record = { id: crypto.randomUUID(), ...session };
    this.sessions.set(record.tokenHash, clone(record));
    return clone(record);
  }

  async findSession(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const user = this.users.get(session.userId);
    return clone({ ...session, email: user?.email, name: user?.name });
  }

  async revokeSession(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = new Date().toISOString();
  }

  async revokeOtherSessions(userId, currentTokenHash) {
    this.sessions.forEach((session) => {
      if (session.userId === userId && session.tokenHash !== currentTokenHash) session.revokedAt = new Date().toISOString();
    });
  }

  async getWorkspace(userId) {
    const workspace = this.workspaces.get(userId);
    return workspace ? clone(workspace) : null;
  }

  async saveWorkspace(userId, state, expectedRevision) {
    const current = this.workspaces.get(userId) || { state: createEmptyState(), revision: 0 };
    if (Number(expectedRevision) !== current.revision) {
      const error = new Error("Conflito de revisão.");
      error.code = "REVISION_CONFLICT";
      throw error;
    }
    const workspace = { state: clone(state), revision: current.revision + 1 };
    this.workspaces.set(userId, workspace);
    return clone(workspace);
  }

  async createAttachment(attachment) {
    const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...attachment };
    this.attachments.set(record.id, clone(record));
    return clone(record);
  }

  async listAttachments(userId, entityType, entityId) {
    return clone([...this.attachments.values()].filter((item) => item.userId === userId && item.entityType === entityType && item.entityId === entityId));
  }

  async listAllAttachments(userId) {
    return clone([...this.attachments.values()].filter((item) => item.userId === userId));
  }

  async findAttachment(userId, attachmentId) {
    const record = this.attachments.get(attachmentId);
    return clone(record?.userId === userId ? record : null);
  }

  async deleteAttachment(userId, attachmentId) {
    const record = this.attachments.get(attachmentId);
    if (record?.userId !== userId) return null;
    this.attachments.delete(attachmentId);
    return clone(record);
  }

  async deleteUser(userId) {
    this.users.delete(userId);
    this.workspaces.delete(userId);
    this.sessions.forEach((session, key) => {
      if (session.userId === userId) this.sessions.delete(key);
    });
    this.attachments.forEach((attachment, key) => {
      if (attachment.userId === userId) this.attachments.delete(key);
    });
  }

  async close() {}
}

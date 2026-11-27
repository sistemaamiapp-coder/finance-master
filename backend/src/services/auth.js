import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AppError, UnauthorizedError } from "./errors.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "meu_lar_session";
const CSRF_COOKIE = "meu_lar_csrf";

export const sessionCookieName = SESSION_COOKIE;
export const csrfCookieName = CSRF_COOKIE;

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError("Informe um e-mail válido.");
  return email;
}

export function validatePassword(value, label = "senha") {
  const password = String(value || "");
  if (password.length < 10 || password.length > 128) throw new AppError(`A ${label} deve ter entre 10 e 128 caracteres.`);
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new AppError(`A ${label} precisa conter letras e números.`);
  return password;
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = String(stored || "").split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derived = await scrypt(String(password || ""), salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export class AuthService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.sessionDays = options.sessionDays || 7;
    this.cookieSecure = options.cookieSecure === true;
    this.authenticate = this.authenticate.bind(this);
    this.requireCsrf = this.requireCsrf.bind(this);
  }

  async register({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const displayName = String(name || "").trim().slice(0, 120);
    if (!displayName) throw new AppError("Informe seu nome.");
    if (await this.repository.findUserByEmail(normalizedEmail)) throw new AppError("Este e-mail já está cadastrado.", 409, "EMAIL_EXISTS");
    const user = await this.repository.createUser({ email: normalizedEmail, name: displayName, passwordHash: await hashPassword(password) });
    return this.publicUser(user);
  }

  async login({ email, password }) {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!user || !(await verifyPassword(password, user.password_hash || user.passwordHash))) {
      throw new UnauthorizedError("E-mail ou senha inválidos.");
    }
    return this.publicUser(user);
  }

  async createSession(userId, res) {
    const token = newToken();
    const csrfToken = newToken(24);
    const expiresAt = new Date(Date.now() + this.sessionDays * 86400000).toISOString();
    const session = await this.repository.createSession({ userId, tokenHash: hashToken(token), csrfHash: hashToken(csrfToken), expiresAt });
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: this.cookieSecure, sameSite: "strict", maxAge: this.sessionDays * 86400000, path: "/" });
    res.cookie(CSRF_COOKIE, csrfToken, { httpOnly: false, secure: this.cookieSecure, sameSite: "strict", maxAge: this.sessionDays * 86400000, path: "/" });
    return { session, csrfToken };
  }

  async authenticate(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next(new UnauthorizedError());
    const session = await this.repository.findSession(hashToken(token));
    if (!session || session.revoked_at || session.revokedAt || new Date(session.expires_at || session.expiresAt).getTime() <= Date.now()) {
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.clearCookie(CSRF_COOKIE, { path: "/" });
      return next(new UnauthorizedError());
    }
    req.auth = { user: { id: session.user_id || session.userId, email: session.email, name: session.name }, session, token };
    req.csrfToken = req.cookies?.[CSRF_COOKIE] || "";
    next();
  }

  requireCsrf(req, res, next) {
    const supplied = req.get("X-CSRF-Token") || "";
    const expected = req.csrfToken || "";
    const sessionHash = req.auth?.session?.csrf_hash || req.auth?.session?.csrfHash;
    if (!supplied || !expected || supplied !== expected || !sessionHash || hashToken(supplied) !== sessionHash) {
      return next(new AppError("Sessão expirada. Recarregue a página e faça login novamente.", 403, "CSRF_INVALID"));
    }
    next();
  }

  async logout(req, res) {
    await this.repository.revokeSession(hashToken(req.auth.token));
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.clearCookie(CSRF_COOKIE, { path: "/" });
  }

  async updateProfile(userId, name) {
    const displayName = String(name || "").trim().slice(0, 120);
    if (!displayName) throw new AppError("Informe seu nome.");
    const user = await this.repository.updateProfile(userId, displayName);
    return this.publicUser(user);
  }

  async changePassword(userId, currentPassword, newPassword, currentTokenHash) {
    const currentUser = await this.repository.findUserById(userId);
    if (!currentUser) throw new AppError("Usuária não encontrada.", 404, "USER_NOT_FOUND");
    const user = await this.repository.findUserByEmail(currentUser.email);
    if (!(await verifyPassword(currentPassword, user.password_hash || user.passwordHash))) throw new AppError("Senha atual incorreta.", 403, "PASSWORD_INCORRECT");
    await this.repository.updatePassword(userId, await hashPassword(newPassword));
    if (currentTokenHash) await this.repository.revokeOtherSessions(userId, currentTokenHash);
  }

  publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at || user.createdAt };
  }
}

import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { AuthService, hashToken } from "./services/auth.js";
import { AppError, ConflictError, UnauthorizedError, ValidationError } from "./services/errors.js";
import { annualSummary, normalizeState, PRODUCT_NAME, validateState } from "./services/finance.js";
import { AttachmentService, MAX_ATTACHMENT_BYTES } from "./services/attachments.js";
import { config } from "./config/index.js";

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createApp({ repository, auth = new AuthService(repository, config), attachmentStorage }) {
  const app = express();
  const attachments = new AttachmentService(repository, attachmentStorage);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", config.corsOrigin],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    const sameOrigin = `${req.protocol}://${req.get("host")}`;
    if (origin && origin !== config.corsOrigin && origin !== sameOrigin) return next(new AppError("Origem não autorizada.", 403, "ORIGIN_DENIED"));
    res.setHeader("Access-Control-Allow-Origin", origin === sameOrigin ? sameOrigin : config.corsOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    next();
  });
  app.options("/api/{*path}", (req, res) => {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token,X-File-Name");
    res.sendStatus(204);
  });
  app.use(express.json({ limit: "2mb", strict: true }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Muitas tentativas. Aguarde alguns minutos." } });
  const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });

  app.get("/api/health", (req, res) => res.json({ ok: true, product: PRODUCT_NAME, database: repository.constructor.name !== "MemoryRepository" }));
  app.post("/api/auth/register", authLimiter, asyncRoute(async (req, res) => {
    const user = await auth.register(req.body || {});
    const { csrfToken } = await auth.createSession(user.id, res);
    res.status(201).json({ user, csrfToken });
  }));
  app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
    const user = await auth.login(req.body || {});
    const { csrfToken } = await auth.createSession(user.id, res);
    res.json({ user, csrfToken });
  }));
  app.post("/api/auth/logout", auth.authenticate, auth.requireCsrf, asyncRoute(async (req, res) => {
    await auth.logout(req, res);
    res.json({ ok: true });
  }));
  app.get("/api/auth/me", auth.authenticate, (req, res) => res.json({ user: req.auth.user }));
  app.put("/api/auth/profile", auth.authenticate, auth.requireCsrf, writeLimiter, asyncRoute(async (req, res) => {
    const user = await auth.updateProfile(req.auth.user.id, req.body?.name);
    res.json({ user });
  }));
  app.post("/api/auth/password", auth.authenticate, auth.requireCsrf, writeLimiter, asyncRoute(async (req, res) => {
    await auth.changePassword(req.auth.user.id, req.body?.currentPassword, req.body?.newPassword, hashToken(req.auth.token));
    res.json({ ok: true });
  }));
  app.delete("/api/auth/account", auth.authenticate, auth.requireCsrf, asyncRoute(async (req, res) => {
    const createdAt = new Date(req.auth.session.created_at || req.auth.session.createdAt).getTime();
    if (Date.now() - createdAt > 5 * 60 * 1000) throw new AppError("Para excluir a conta, saia e entre novamente. Isso protege seus dados.", 403, "REAUTH_REQUIRED");
    await attachments.removeUserFiles(req.auth.user.id);
    await repository.deleteUser(req.auth.user.id);
    res.clearCookie("meu_lar_session", { path: "/" });
    res.clearCookie("meu_lar_csrf", { path: "/" });
    res.json({ ok: true });
  }));

  app.get("/api/state", auth.authenticate, asyncRoute(async (req, res) => {
    const workspace = await repository.getWorkspace(req.auth.user.id);
    res.json({ state: workspace.state, revision: workspace.revision });
  }));
  app.put("/api/state", auth.authenticate, auth.requireCsrf, writeLimiter, asyncRoute(async (req, res) => {
    const expectedRevision = Number(req.body?.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new AppError("Revisão inválida.");
    let state;
    try { state = validateState(req.body?.state); }
    catch (error) { throw new ValidationError(error.message); }
    try {
      const workspace = await repository.saveWorkspace(req.auth.user.id, state, expectedRevision);
      res.json({ state: workspace.state, revision: workspace.revision });
    } catch (error) {
      if (error.code === "REVISION_CONFLICT") throw new ConflictError();
      throw error;
    }
  }));
  app.get("/api/backup", auth.authenticate, asyncRoute(async (req, res) => {
    const workspace = await repository.getWorkspace(req.auth.user.id);
    res.setHeader("Content-Disposition", `attachment; filename="meu-lar-financeiro-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ product: PRODUCT_NAME, exportedAt: new Date().toISOString(), revision: workspace.revision, state: workspace.state });
  }));
  app.get("/api/reports/annual/:year", auth.authenticate, asyncRoute(async (req, res) => {
    const workspace = await repository.getWorkspace(req.auth.user.id);
    res.json({ year: Number(req.params.year), months: annualSummary(workspace.state, req.params.year) });
  }));

  app.post("/api/attachments/upload/:entityType/:entityId", auth.authenticate, auth.requireCsrf, writeLimiter, express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES, inflate: false }), asyncRoute(async (req, res) => {
    const attachment = await attachments.upload(req.auth.user.id, req.params.entityType, req.params.entityId, req.body, req.get("Content-Type"), req.get("X-File-Name"));
    res.status(201).json({ attachment });
  }));
  app.get("/api/attachments/content/:id", auth.authenticate, asyncRoute(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw new AppError("Comprovante não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    const { content, attachment } = await attachments.download(req.auth.user.id, req.params.id);
    const fallback = `comprovante.${attachment.mimeType === "application/pdf" ? "pdf" : attachment.mimeType.split("/")[1].replace("jpeg", "jpg")}`;
    const encoded = encodeURIComponent(attachment.filename).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", content.length);
    res.setHeader("Content-Disposition", `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`);
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(content);
  }));
  app.get("/api/attachments/:entityType/:entityId", auth.authenticate, asyncRoute(async (req, res) => {
    res.json({ attachments: await attachments.list(req.auth.user.id, req.params.entityType, req.params.entityId) });
  }));
  app.delete("/api/attachments/:id", auth.authenticate, auth.requireCsrf, writeLimiter, asyncRoute(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw new AppError("Comprovante não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    await attachments.remove(req.auth.user.id, req.params.id);
    res.json({ ok: true });
  }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Rota não encontrada." }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const tooLarge = error.type === "entity.too.large";
    const status = tooLarge ? 413 : error.status || 500;
    if (status >= 500) console.error("Erro na API", error);
    res.status(status).json({
      error: tooLarge ? "Cada comprovante deve ter no máximo 5 MiB." : error.message || "Erro interno.",
      code: tooLarge ? "ATTACHMENT_TOO_LARGE" : error.code || "INTERNAL_ERROR",
      details: error.details,
    });
  });
  return app;
}

import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { FileAttachmentStorage } from "./services/attachments.js";
import { config, assertServerConfig } from "./config/index.js";
import { PostgresRepository } from "./repositories/postgres.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

export function mountPublicFiles(app) {
  const publicFiles = new Set(["index.html", "manifest.webmanifest", "sw.js", "favicon.ico", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "backend/src/services/finance.js"]);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    let pathname;
    try { pathname = decodeURIComponent(req.path); }
    catch { return res.sendStatus(400); }
    const allowed = pathname === "/"
      || publicFiles.has(pathname.slice(1))
      || /^\/assets\/(?:css|js|img)\/[a-zA-Z0-9._-]+$/.test(pathname);
    if (!allowed) return res.sendStatus(404);
    next();
  });
  app.use(express.static(root, { dotfiles: "deny", index: "index.html", fallthrough: true }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(root, "index.html"));
  });
}

async function start() {
  assertServerConfig();
  const repository = new PostgresRepository(config.databaseUrl);
  const app = createApp({ repository, attachmentStorage: config.attachmentDir ? new FileAttachmentStorage(config.attachmentDir) : undefined });
  mountPublicFiles(app);
  const server = app.listen(config.port, () => console.log(`Meu Lar Financeiro disponível em http://localhost:${config.port}`));
  const shutdown = async () => {
    server.close(async () => {
      await repository.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

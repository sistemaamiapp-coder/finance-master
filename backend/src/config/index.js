import "dotenv/config";

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value == null || value === "") throw new Error(`Variável de ambiente obrigatória: ${name}`);
  return value;
};

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  sessionDays: Math.min(30, Math.max(1, Number(process.env.SESSION_DAYS || 7))),
  attachmentDir: process.env.ATTACHMENT_DIR || "",
  isProduction: process.env.NODE_ENV === "production",
  get databaseRequired() {
    return this.env !== "test";
  },
};

export function assertServerConfig() {
  if (config.databaseRequired && !config.databaseUrl) {
    throw new Error("DATABASE_URL é obrigatória fora do ambiente de testes.");
  }
  if (config.isProduction && !config.cookieSecure) {
    throw new Error("COOKIE_SECURE=true é obrigatório em produção.");
  }
  required("CORS_ORIGIN", config.corsOrigin);
  if (config.isProduction && new URL(config.corsOrigin).protocol !== "https:") {
    throw new Error("CORS_ORIGIN deve usar HTTPS em produção.");
  }
}

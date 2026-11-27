(function () {
  "use strict";
  const FM = window.FM;
  const configuredBase = String(window.MEU_LAR_CONFIG?.apiBase || "").replace(/\/$/, "");
  const cookieName = "meu_lar_csrf";

  function readCookie(name) {
    const prefix = `${name}=`;
    const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
  }

  function makeError(message, status, code, details) {
    const error = new Error(message || "Não foi possível concluir a solicitação.");
    error.status = status;
    error.code = code;
    error.details = details;
    return error;
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (!["GET", "HEAD", "OPTIONS"].includes(options.method || "GET")) {
      const csrf = FM.api.csrfToken || readCookie(cookieName);
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }
    try {
      const response = await fetch(`${configuredBase}/api${path}`, {
        method: options.method || "GET",
        credentials: "include",
        cache: "no-store",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        const error = makeError(payload?.error || "Falha na comunicação com o servidor.", response.status, payload?.code, payload?.details);
        if (response.status === 401 && !options.authAttempt) window.dispatchEvent(new CustomEvent("meular:unauthorized"));
        throw error;
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw makeError("O servidor demorou para responder. Tente novamente.", 0, "TIMEOUT");
      if (error instanceof TypeError) throw makeError("Não foi possível conectar ao servidor.", 0, "NETWORK_ERROR");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  FM.api = {
    baseUrl: configuredBase,
    available: false,
    user: null,
    csrfToken: "",

    async detect() {
      try {
        const health = await request("/health", { timeout: 2500 });
        this.available = health?.ok === true && health?.product === "Meu Lar Financeiro";
      } catch (error) {
        this.available = false;
      }
      return this.available;
    },

    async register(data) {
      const result = await request("/auth/register", { method: "POST", body: data, authAttempt: true });
      this.user = result.user;
      this.csrfToken = result.csrfToken;
      return result;
    },

    async login(data) {
      const result = await request("/auth/login", { method: "POST", body: data, authAttempt: true });
      this.user = result.user;
      this.csrfToken = result.csrfToken;
      return result;
    },

    async me() {
      try {
        const result = await request("/auth/me", { authAttempt: true });
        this.user = result.user;
        this.csrfToken = this.csrfToken || readCookie(cookieName);
        return result.user;
      } catch (error) {
        if (error.status === 401) {
          this.user = null;
          return null;
        }
        throw error;
      }
    },

    async logout() {
      try { await request("/auth/logout", { method: "POST", body: {} }); }
      finally {
        this.user = null;
        this.csrfToken = "";
      }
    },

    updateProfile(name) {
      return request("/auth/profile", { method: "PUT", body: { name } });
    },

    changePassword(currentPassword, newPassword) {
      return request("/auth/password", { method: "POST", body: { currentPassword, newPassword } });
    },

    deleteAccount() {
      return request("/auth/account", { method: "DELETE", body: {} });
    },

    getState() {
      return request("/state");
    },

    saveState(state, expectedRevision) {
      return request("/state", { method: "PUT", body: { state, expectedRevision } });
    },

    annualReport(year) {
      return request(`/reports/annual/${encodeURIComponent(year)}`);
    },

    async downloadBackup() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${configuredBase}/api/backup`, { credentials: "include", cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw makeError(payload?.error || "Não foi possível baixar o backup.", response.status, payload?.code);
        }
        const disposition = response.headers.get("content-disposition") || "";
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `meu-lar-financeiro-backup-${new Date().toISOString().slice(0, 10)}.json`;
        FM.utils.downloadFile(await response.blob(), filename);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
})();

(function () {
  "use strict";
  const FM = window.FM;
  const { esc, fmtDateTime } = FM.utils;
  const icon = FM.ui.icon;
  const MAX_BYTES = 5 * 1024 * 1024;
  const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

  function csrfToken() {
    const prefix = "meu_lar_csrf=";
    const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
  }

  async function call(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
    const headers = new Headers(options.headers || {});
    if (!["GET", "HEAD"].includes(options.method || "GET")) {
      const token = FM.api.csrfToken || csrfToken();
      if (token) headers.set("X-CSRF-Token", token);
    }
    try {
      const response = await fetch(`${FM.api.baseUrl}/api${path}`, {
        method: options.method || "GET",
        credentials: "include",
        cache: "no-store",
        headers,
        body: options.body,
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const error = new Error(payload?.error || "Não foi possível concluir a operação.");
        error.status = response.status;
        error.code = payload?.code;
        throw error;
      }
      return options.blob ? response : response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O servidor demorou para responder. Tente novamente.");
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao servidor.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function available() {
    return !!FM.store.remote && !!FM.api.available;
  }

  function inputField() {
    if (!available()) return "";
    return `<div class="field full"><label>Comprovantes (opcional)</label><input class="input" type="file" data-attachment-input accept="${ACCEPT}" multiple><span class="hint">PDF, JPEG, PNG ou WebP · até 5 MiB por arquivo.</span></div>`;
  }

  function row(attachment) {
    return `<div class="attachment-row" data-attachment-row="${esc(attachment.id)}">
      <div class="attachment-file">${icon("file")}<div><strong>${esc(attachment.filename)}</strong><span>${(attachment.sizeBytes / 1024).toFixed(1).replace(".", ",")} KiB · ${esc(fmtDateTime(attachment.createdAt))}</span></div></div>
      <div class="row no-print"><button class="icon-btn sm" data-attachment-download="${esc(attachment.id)}" title="Baixar comprovante">${icon("download")}</button><button class="icon-btn sm danger" data-attachment-delete="${esc(attachment.id)}" title="Excluir comprovante">${icon("trash")}</button></div>
    </div>`;
  }

  async function upload(entityType, entityId, files) {
    if (!available()) throw new Error("Os comprovantes estão disponíveis somente em contas conectadas ao servidor.");
    const uploaded = [];
    for (const file of files) {
      if (!file.size) throw new Error(`O arquivo ${file.name} está vazio.`);
      if (file.size > MAX_BYTES) throw new Error(`${file.name} ultrapassa o limite de 5 MiB.`);
      if (file.type && !ACCEPT.split(",").includes(file.type)) throw new Error(`${file.name} não é PDF, JPEG, PNG ou WebP.`);
      const result = await call(`/attachments/upload/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      uploaded.push(result.attachment);
    }
    return uploaded;
  }

  async function list(entityType, entityId) {
    const result = await call(`/attachments/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`);
    return result.attachments || [];
  }

  async function download(attachment) {
    const response = await call(`/attachments/content/${encodeURIComponent(attachment.id)}`, { blob: true });
    FM.utils.downloadFile(await response.blob(), attachment.filename);
  }

  async function remove(attachmentId) {
    await call(`/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE" });
  }

  async function mount(container, entityType, entityId) {
    if (!container) return;
    if (!available()) {
      container.innerHTML = `<p class="small muted">Comprovantes ficam disponíveis quando a conta está conectada ao servidor.</p>`;
      return;
    }
    container.innerHTML = `<div class="attachment-loading small muted">Carregando comprovantes...</div>`;
    try {
      const attachments = await list(entityType, entityId);
      if (!container.isConnected) return;
      container.innerHTML = `<div class="attachment-head"><div><strong>Comprovantes</strong><span>Arquivos privados vinculados a este registro.</span></div><span class="badge muted">${attachments.length}</span></div>
        <div class="attachment-list">${attachments.length ? attachments.map(row).join("") : `<p class="small muted">Nenhum comprovante anexado.</p>`}</div>
        <div class="attachment-upload"><input class="input" type="file" data-attachment-input accept="${ACCEPT}" multiple><button class="btn ghost sm" type="button" data-attachment-send>${icon("upload")}Enviar arquivos</button></div>
        <p class="hint mt-8">PDF, JPEG, PNG ou WebP · até 5 MiB por arquivo.</p>`;
      container.querySelector("[data-attachment-send]").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const input = container.querySelector("[data-attachment-input]");
        if (!input.files.length) return FM.ui.toast("Selecione ao menos um comprovante.", "warn");
        button.disabled = true;
        try {
          await upload(entityType, entityId, [...input.files]);
          FM.ui.toast("Comprovante enviado.");
          await mount(container, entityType, entityId);
        } catch (error) {
          FM.ui.toast(error.message, "error");
        } finally {
          button.disabled = false;
        }
      });
      container.querySelectorAll("[data-attachment-download]").forEach((button) => button.addEventListener("click", async () => {
        const attachment = attachments.find((item) => item.id === button.dataset.attachmentDownload);
        try { await download(attachment); }
        catch (error) { FM.ui.toast(error.message, "error"); }
      }));
      container.querySelectorAll("[data-attachment-delete]").forEach((button) => button.addEventListener("click", async () => {
        const attachment = attachments.find((item) => item.id === button.dataset.attachmentDelete);
        const ok = await FM.ui.confirm({ title: "Excluir comprovante", message: `O arquivo <b>${esc(attachment.filename)}</b> será removido definitivamente.`, confirmLabel: "Excluir", danger: true });
        if (!ok) return;
        try {
          await remove(attachment.id);
          FM.ui.toast("Comprovante excluído.", "info");
          await mount(container, entityType, entityId);
        } catch (error) { FM.ui.toast(error.message, "error"); }
      }));
    } catch (error) {
      if (!container.isConnected) return;
      container.innerHTML = `<p class="small text-red">${esc(error.message)}</p>`;
    }
  }

  function open(entityType, entityId, title = "Comprovantes") {
    if (!available()) return FM.ui.toast("Os comprovantes estão disponíveis somente em contas conectadas ao servidor.", "warn");
    FM.ui.modal({
      title,
      subtitle: "PDF, JPEG, PNG ou WebP · até 5 MiB por arquivo",
      size: "lg",
      body: `<div data-attachment-manager></div>`,
      footer: `<button class="btn ghost" data-close>Fechar</button>`,
      onMount(ov) { mount(ov.querySelector("[data-attachment-manager]"), entityType, entityId); },
    });
  }

  FM.attachments = { available, inputField, upload, list, download, remove, mount, open };
})();

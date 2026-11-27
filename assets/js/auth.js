(function () {
  "use strict";
  const FM = window.FM;
  const icon = FM.ui.icon;

  function setMessage(message, tone) {
    const box = document.querySelector("#auth-message");
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || "";
    box.className = `auth-message ${tone || "error"}`;
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? "Aguarde..." : button.dataset.label;
  }

  function render(mode) {
    const root = document.querySelector("#auth-root");
    const shell = document.querySelector("#app-shell");
    if (!root) return;
    if (shell) shell.hidden = true;
    root.hidden = false;
    document.body.classList.add("auth-open");
    const register = mode === "register";
    root.innerHTML = `
      <main class="auth-layout">
        <section class="auth-story">
          <img class="auth-logo" src="assets/img/livis-finance-light-192.png" alt="Meu Lar Financeiro" data-theme-icon>
          <p class="auth-eyebrow">Seu dinheiro, seu lar, seus sonhos</p>
          <h1>Meu Lar <br>Financeiro</h1>
          <p class="auth-slogan">Organize seu dinheiro, cuide do seu lar e realize seus sonhos.</p>
          <div class="auth-points">
            <span>${icon("shield")}Privacidade e segurança</span>
            <span>${icon("trending-up")}Controle claro do mês</span>
            <span>${icon("flower")}Feito para sua rotina</span>
          </div>
        </section>
        <section class="auth-panel">
          <div class="auth-card">
            <div class="auth-tabs" role="tablist" aria-label="Acesso à conta">
              <button type="button" role="tab" aria-selected="${!register}" data-auth-mode="login">Entrar</button>
              <button type="button" role="tab" aria-selected="${register}" data-auth-mode="register">Criar conta</button>
            </div>
            <h2>${register ? "Comece a organizar seu lar" : "Que bom ter você de volta"}</h2>
            <p class="small muted">${register ? "Crie sua conta para salvar seus dados com segurança." : "Entre com seu e-mail e senha para continuar."}</p>
            <form id="auth-form" class="auth-form mt-16">
              ${register ? '<div class="field"><label for="auth-name">Seu nome</label><input class="input" id="auth-name" name="name" maxlength="120" autocomplete="name" required></div>' : ""}
              <div class="field"><label for="auth-email">E-mail</label><input class="input" id="auth-email" name="email" type="email" maxlength="254" autocomplete="email" required></div>
              <div class="field"><label for="auth-password">Senha</label><input class="input" id="auth-password" name="password" type="password" minlength="10" maxlength="128" autocomplete="${register ? "new-password" : "current-password"}" required><span class="field-hint">Use de 10 a 128 caracteres, com letras e números.</span></div>
              <div id="auth-message" class="auth-message error" role="alert" hidden></div>
              <button class="btn primary auth-submit" type="submit" data-label="${register ? "Criar minha conta" : "Entrar no sistema"}">${register ? "Criar minha conta" : "Entrar no sistema"}</button>
            </form>
            <p class="auth-privacy">${icon("shield")}Seus dados financeiros ficam associados à sua conta. Não guardamos senhas bancárias, CVV ou PIN.</p>
          </div>
        </section>
      </main>
    `;
    if (FM.theme) FM.theme.apply(FM.theme.current, { persist: false });
    root.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => render(button.dataset.authMode));
    });
    root.querySelector("#auth-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      setMessage("");
      setBusy(form, true);
      try {
        const result = register ? await FM.api.register(data) : await FM.api.login(data);
        await onSuccess(result);
      } catch (error) {
        setMessage(error.message || "Não foi possível entrar.", "error");
        setBusy(form, false);
      }
    });
    setTimeout(() => root.querySelector("input")?.focus(), 50);
  }

  let onSuccess = async () => {};

  FM.auth = {
    show(callback) {
      onSuccess = callback || onSuccess;
      render("login");
    },
    hide() {
      const root = document.querySelector("#auth-root");
      const shell = document.querySelector("#app-shell");
      if (root) {
        root.hidden = true;
        root.innerHTML = "";
      }
      if (shell) shell.hidden = false;
      document.body.classList.remove("auth-open");
    },
  };
})();

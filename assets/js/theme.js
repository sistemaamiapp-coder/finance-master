(function () {
  "use strict";
  const FM = (window.FM = window.FM || {});
  const KEY = "meu_lar_financeiro.theme";
  const light = {
    themeColor: "#fff9f5",
    logo: "assets/img/livis-finance-light-192.png",
    favicon: "assets/img/livis-finance-light-64.png",
    touch: "assets/img/livis-finance-light-192.png",
  };
  const dark = {
    themeColor: "#0c1020",
    logo: "assets/img/livis-finance-192.png",
    favicon: "assets/img/livis-finance-64.png",
    touch: "assets/img/livis-finance-192.png",
  };

  function apply(value, options = {}) {
    const theme = value === "dark" ? "dark" : "light";
    const assets = theme === "dark" ? dark : light;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = assets.themeColor;
    document.querySelectorAll("img[data-theme-icon]").forEach((image) => { image.src = assets.logo; });
    const favicon = document.querySelector('link[data-theme-icon="favicon"]');
    if (favicon) favicon.href = assets.favicon;
    const touch = document.querySelector('link[data-theme-icon="touch"]');
    if (touch) touch.href = assets.touch;
    const social = document.querySelector('meta[property="og:image"]');
    if (social) social.content = new URL(assets.logo, document.baseURI).href;
    if (options.persist !== false) {
      try { localStorage.setItem(KEY, theme); } catch (error) {}
    }
    FM.theme.current = theme;
    return theme;
  }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (error) { return "light"; }
  }

  FM.theme = {
    current: "light",
    apply,
    toggle() { return apply(this.current === "dark" ? "light" : "dark"); },
  };
  apply(stored(), { persist: false });
})();

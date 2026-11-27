window.addEventListener("load", () => {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.error("Falha ao registrar o modo offline", error);
  });
});

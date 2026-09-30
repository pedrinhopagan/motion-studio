// A ponte existe apenas na prévia do Studio. A fonte no disco continua sendo
// a mesma usada pelos renders e pela abertura em outra aba.
export function livePreviewHtml(html: string, parentOrigin: string) {
  const bridge = `<style>
html,body{width:100%;height:100%;overflow:hidden;background:transparent!important}
body{display:flex;align-items:center;justify-content:center}
body .bar{display:none!important}
body canvas{width:100%!important;height:100%!important;object-fit:contain}
</style><script>
(() => {
  const origin = ${JSON.stringify(parentOrigin)};
  const status = (ready, error) => parent.postMessage({type: "motion-studio:status", ready, ...(error ? {error} : {})}, origin);
  let ready = false;
  let pending = Number(new URLSearchParams(location.search).get("t")) || 0;
  const render = () => {
    try { window.seek(pending); }
    catch { ready = false; status(false, "Não foi possível desenhar a composição neste tempo."); }
  };
  addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== origin || !event.data || event.data.type !== "motion-studio:seek" || !Number.isFinite(event.data.time)) return;
    pending = Math.max(0, event.data.time);
    if (ready) render();
  });
  const started = performance.now();
  const check = () => {
    if (window.ready && typeof window.seek === "function") {
      ready = true;
      render();
      if (ready) status(true);
      return;
    }
    if (performance.now() - started > 15000) {
      status(false, "A composição não ficou pronta. Abra a fonte em outra aba para conferir o carregamento.");
      return;
    }
    setTimeout(check, 100);
  };
  check();
})();
</script>`;

  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${bridge}</body>`);
  }

  return `${html}${bridge}`;
}

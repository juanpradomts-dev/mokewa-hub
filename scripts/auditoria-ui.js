// Auditoría de UI con Playwright CLI (skill playwright-cli): axe, encabezados, desbordes, objetivos táctiles,
// largo de línea, metadatos y superficies del navegador, en escritorio (1280) y celular (390).
// Uso, con la demo corriendo (npm run dev):
//   npx playwright-cli open --browser=msedge http://localhost:4321/
//   npx playwright-cli run-code --filename=scripts/auditoria-ui.js
async page => {
  const BASE = "http://localhost:4321";
  const RUTAS = ["/", "/academia/", "/torneos/", "/torneos/verano-2027/", "/el-club/", "/contacto/", "/privacidad/", "/no-existe/", "/panel/"];
  const salida = {};
  for (const ancho of [1280, 390]) {
    await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
    for (const ruta of RUTAS) {
      await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      if (ancho === 1280) await page.addScriptTag({ url: BASE + "/node_modules/axe-core/axe.min.js" });
      const r = await page.evaluate(async (ancho) => {
        const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
        const out = {};
        if (window.axe) out.axe = (await axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
        out.desborde = document.documentElement.scrollWidth - innerWidth;
        // encabezados: saltos de nivel
        const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis).map((h) => +h.tagName[1]);
        out.h1 = hs.filter((n) => n === 1).length;
        out.saltos = hs.map((n, i) => (i && n - hs[i - 1] > 1 ? `h${hs[i - 1]}→h${n}` : null)).filter(Boolean);
        // objetivos táctiles chicos (solo celular)
        if (ancho === 390) out.tactilesChicos = [...document.querySelectorAll("a,button,input,select,textarea,summary,[role=tab]")]
          .filter(vis).filter((el) => { const b = el.getBoundingClientRect(); return (b.height < 44 || b.width < 44) && !el.closest("p, li p, td, .nota, .legal, .ayuda, .fuente, small") && el.type !== "checkbox"; })
          .slice(0, 8).map((el) => `${el.tagName.toLowerCase()}「${(el.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 28)}」${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        // ancho de lectura en caracteres (párrafos de main)
        const medir = document.createElement("span"); medir.textContent = "0000000000"; medir.style.cssText = "position:absolute;visibility:hidden"; document.body.append(medir);
        out.medidaMax = Math.max(0, ...[...document.querySelectorAll("main p")].filter(vis).filter((p) => p.innerText.length > 120).map((p) => {
          medir.style.font = getComputedStyle(p).font; return Math.round(p.clientWidth / (medir.getBoundingClientRect().width / 10));
        }));
        medir.remove();
        out.antetitulos = document.querySelectorAll(".antetitulo").length;
        out.exclamaciones = (document.querySelector("main")?.innerText.match(/¡[^!]{0,40}!/g) || []).slice(0, 4);
        if (ancho === 1280) {
          const m = (sel) => document.querySelector(sel)?.getAttribute("content") ?? document.querySelector(sel)?.getAttribute("href") ?? null;
          out.meta = { title: document.title, desc: m('meta[name="description"]'), canonical: m('link[rel="canonical"]'), ogTitle: m('meta[property="og:title"]'), ogImage: m('meta[property="og:image"]'), ogUrl: m('meta[property="og:url"]'), twitter: m('meta[name="twitter:card"]'), robots: m('meta[name="robots"]'), lang: document.documentElement.lang, icon: m('link[rel="icon"]') };
        }
        return out;
      }, ancho);
      salida[`${ancho} ${ruta}`] = r;
    }
  }
  // Superficies del navegador y movimiento: reglas presentes en el CSS
  const css = await page.evaluate(() => [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n"));
  salida.css = {
    selection: /::selection/.test(css), caret: /caret-color/.test(css), accent: /accent-color/.test(css), scrollbar: /scrollbar-color/.test(css), subrayado: /text-underline-offset/.test(css), tabular: /tabular-nums/.test(css),
    bordeIzquierdoGrueso: (css.match(/border-left:\s*([2-9]|\d{2})px[^;]*/g) || []).slice(0, 6),
    transicionesDeLayout: (css.match(/transition[^;{}]*\b(width|height|top|left|margin|padding)\b[^;{}]*/g) || []).slice(0, 6),
    willChange: (css.match(/will-change:[^;]+/g) || []).length,
    zIndex: [...new Set(css.match(/z-index:\s*\d+/g) || [])],
  };
  return JSON.stringify(salida, null, 1);
}

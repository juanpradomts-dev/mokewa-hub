// Redirección inmediata y en español para las páginas que la web oficial no publica (panel sin base de
// datos, página de la demo, torneo de ejemplo). Reemplaza la de Astro, que en un sitio estático muestra
// «Redirecting from…» en inglés durante dos segundos.
export function redirigir(destino) {
  const html = `<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${destino}"><title>Ajedrez Club Mokewa</title><script>location.replace(${JSON.stringify(destino)})</script></head><body style="font-family:system-ui,sans-serif;background:#fbf5ef;color:#1a1714;padding:24px"><p>Esta página ya no está aquí. <a href="${destino}" style="color:#a64b08">Ir a la web del club</a>.</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

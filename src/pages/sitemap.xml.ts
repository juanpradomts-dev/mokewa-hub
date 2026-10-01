// Sitemap de la web oficial. En la demo (o con PUBLIC_INDEXAR=no) sale vacío.
// Solo páginas públicas con contenido real: sin panel, sin páginas de la demo y sin el torneo de ejemplo.
import type { APIRoute } from "astro";
import { indexar, valor } from "../lib/contenido.js";

export const GET: APIRoute = ({ site }) => {
  const b = import.meta.env.BASE_URL.replace(/\/$/, "");
  const rutas = indexar
    ? ["/", "/academia/", "/torneos/", "/el-club/", "/contacto/", "/privacidad/", ...(valor("verano_fecha") ? ["/torneos/verano-2027/"] : [])]
    : [];
  const urls = rutas.map((r) => `  <url><loc>${new URL(`${b}${r}`, site).href}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};

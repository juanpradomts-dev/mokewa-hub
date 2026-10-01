// robots.txt: la web oficial se indexa (menos el panel) y declara el sitemap; la demo, o con PUBLIC_INDEXAR=no, no.
import type { APIRoute } from "astro";
import { indexar } from "../lib/contenido.js";

export const GET: APIRoute = ({ site }) => {
  const b = import.meta.env.BASE_URL.replace(/\/$/, "");
  const cuerpo = indexar
    ? `User-agent: *\nDisallow: ${b}/panel/\n\nSitemap: ${new URL(`${b}/sitemap.xml`, site).href}\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(cuerpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};

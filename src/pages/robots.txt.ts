// robots.txt según el modo: la demo no se indexa; la web oficial sí (menos el panel) y declara el sitemap.
import type { APIRoute } from "astro";
import { esProduccion } from "../lib/contenido.js";

export const GET: APIRoute = ({ site }) => {
  const b = import.meta.env.BASE_URL.replace(/\/$/, "");
  const cuerpo = esProduccion
    ? `User-agent: *\nDisallow: ${b}/panel/\n\nSitemap: ${new URL(`${b}/sitemap.xml`, site).href}\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(cuerpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};

// Conteo anónimo de visitas y clics de contacto, para que el dueño sepa si la web le trae inscritos.
// Solo se envía «qué pasó» y «en qué página» (p. ej. «whatsapp» en /contacto/): sin cookies, sin
// identificadores, sin IP guardada. La base de datos suma totales por día (registrar_evento en
// supabase/migrations/). Respeta «No rastrear» y Global Privacy Control del navegador.
//
// - Web oficial con base de datos: se envía a Supabase.
// - Demo: se cuenta en este navegador (así el panel de la demo muestra tus propias visitas).
// - Web oficial sin base de datos: no se cuenta nada.
import { urlBaseDeDatos, clavePublica, hayBaseDeDatos } from "./backend.js";
import { esProduccion } from "./contenido.js";

export const EVENTOS = ["vista", "sesion", "whatsapp", "correo", "facebook", "como_llegar", "inscripcion_inicio"];
const DEMO = "mokewa-demo-visitas";

// «/mokewa-hub/demo/torneos/torneo/» → «/torneos/torneo/» (lo mismo en la demo y en la oficial).
export function paginaDe(ruta, base = "") {
  let p = String(ruta ?? "/");
  if (base && p.startsWith(base)) p = p.slice(base.length);
  p = `/${p.replace(/^\/+/, "")}`.toLowerCase().replace(/index\.html$/, "");
  return /^\/[a-z0-9/_-]{0,60}$/.test(p) ? p : "/otra/";
}

// ¿A qué canal lleva este enlace? (null si no es un contacto)
export function eventoDeEnlace(href) {
  const h = String(href ?? "");
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(h)) return "whatsapp";
  if (/^mailto:/i.test(h)) return "correo";
  if (/^https:\/\/(www\.|m\.)?(facebook\.com|m\.me)\//.test(h)) return "facebook";
  if (/google\.[a-z.]+\/maps\/dir\//.test(h)) return "como_llegar";
  return null;
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function leerDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO) ?? "{}");
  } catch {
    return {};
  }
}
// Filas con la forma de visitas_diarias, para el panel de la demo.
export const visitasDemo = () =>
  Object.entries(leerDemo()).map(([k, total]) => {
    const [dia, pagina, evento] = k.split("|");
    return { dia, pagina, evento, total };
  });
export function borrarVisitasDemo() {
  try {
    localStorage.removeItem(DEMO);
  } catch {}
}

const noRastrear = () => typeof navigator !== "undefined" && (navigator.webdriver || navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true);

export function contar(evento, pagina) {
  if (typeof window === "undefined" || !EVENTOS.includes(evento) || noRastrear()) return;
  const p = pagina ?? paginaDe(location.pathname, document.body?.dataset.base ?? "");
  if (hayBaseDeDatos) {
    // keepalive: el aviso sale aunque el clic abra WhatsApp o cambie de página.
    fetch(`${urlBaseDeDatos}/rest/v1/rpc/registrar_evento`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: clavePublica, Authorization: `Bearer ${clavePublica}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_evento: evento, p_pagina: p }),
    }).catch(() => {});
    return;
  }
  if (esProduccion) return;
  const datos = leerDemo();
  const k = `${hoy()}|${p}|${evento}`;
  datos[k] = (datos[k] ?? 0) + 1;
  try {
    localStorage.setItem(DEMO, JSON.stringify(datos));
  } catch {}
}

// Una vista por página y una «visita» por pestaña (sessionStorage: no sale del navegador).
export function contarVista() {
  contar("vista");
  try {
    if (sessionStorage.getItem("mokewa-visita")) return;
    sessionStorage.setItem("mokewa-visita", "1");
  } catch {
    return;
  }
  contar("sesion");
}

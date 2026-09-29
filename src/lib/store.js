// Capa de datos del navegador para la DEMO.
//
// En la demo todo vive en este navegador (localStorage + IndexedDB para los vouchers),
// así el club puede probar inscripciones y validaciones sin tocar datos reales.
// En producción esta misma interfaz se implementa sobre Supabase (ver supabase/schema.sql):
// cada función de aquí corresponde a una consulta a una tabla con Row Level Security.

import contenidoBase from "../data/contenido.json";
import { CATEGORIAS } from "./categorias.js";
import { enlaceContacto } from "./contacto.js";

const CLAVE = "mokewa-demo-v1";
const EVENTO = "mokewa:cambio";

// ---------------------------------------------------------------- torneo de ejemplo
export const TORNEO_VERANO = {
  id: "verano-2027",
  nombre: "Torneo de Verano 2027",
  ejemplo: true,
  modalidad: "Presencial",
  anio: 2027,
  categorias: CATEGORIAS,
  niveles: ["Básico", "Intermedio", "Avanzado"],
  estado: "publicado",
};

// ---------------------------------------------------------------- estado
const vacio = () => ({ version: 1, contenido: {}, torneos: [], inscripciones: [], noticias: [], resultados: {}, sembrado: false });

let cache = null;
function leer() {
  if (cache) return cache;
  try {
    cache = { ...vacio(), ...JSON.parse(localStorage.getItem(CLAVE) ?? "null") };
  } catch {
    cache = vacio();
  }
  return cache;
}
function guardar(estado) {
  cache = estado;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch (e) {
    console.warn("No se pudo guardar en este navegador:", e);
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}
export function alCambiar(fn) {
  window.addEventListener(EVENTO, fn);
  // Cambios hechos en otra pestaña (p. ej. el panel abierto al lado de la web).
  window.addEventListener("storage", (e) => {
    if (e.key === CLAVE) {
      cache = null;
      fn();
    }
  });
}
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const ahora = () => new Date().toISOString();

// ---------------------------------------------------------------- contenido «por confirmar»
export const CAMPOS = contenidoBase.campos;
export function contenido(campo) {
  const v = leer().contenido[campo];
  return v != null && String(v).trim() !== "" ? String(v).trim() : CAMPOS[campo]?.valor ?? null;
}
export function guardarContenido(valores) {
  const e = leer();
  guardar({ ...e, contenido: { ...e.contenido, ...valores } });
}
export function pendientesDeConfirmar() {
  return Object.keys(CAMPOS).filter((c) => contenido(c) == null);
}

// Pinta en la página todos los [data-campo]: valor confirmado o la etiqueta «por confirmar».
export function pintarCampos(raiz = document) {
  for (const el of raiz.querySelectorAll("[data-campo]")) {
    const campo = el.dataset.campo;
    const valor = contenido(campo);
    if (valor) {
      el.textContent = valor;
      el.classList.add("confirmado");
      el.removeAttribute("title");
    } else {
      el.textContent = el.dataset.vacio || "por confirmar";
      el.classList.remove("confirmado");
      el.title = "Dato pendiente: el club lo completa desde el panel";
    }
  }
  const conClase = !!contenido("clase_prueba");
  for (const a of raiz.querySelectorAll("[data-cta]")) {
    a.dataset.accion = conClase ? "Clase de prueba" : "Pedir informes";
    a.dataset.mensaje = conClase
      ? "Hola, quisiera agendar una clase de prueba de ajedrez."
      : "Hola, quisiera información sobre las clases de ajedrez.";
  }
  const wa = contenido("whatsapp");
  for (const a of raiz.querySelectorAll("[data-contacto]")) {
    const e = enlaceContacto(wa, a.dataset.mensaje, a.dataset.accion);
    a.href = e.href;
    a.dataset.tipo = e.tipo;
    a.setAttribute("aria-label", e.aria);
    const t = a.querySelector(".contacto-texto");
    if (t) t.textContent = e.texto;
  }
}

export { edadAl1Enero, categoriaPara, esMenor } from "./categorias.js";
import { categoriaPara } from "./categorias.js";

// ---------------------------------------------------------------- torneos creados en el panel
export const torneosCreados = () => leer().torneos;
export function todosLosTorneos() {
  return [TORNEO_VERANO, ...leer().torneos];
}
export function torneo(id) {
  return todosLosTorneos().find((t) => t.id === id) ?? null;
}
export function crearTorneo(datos) {
  const e = leer();
  const t = { id: nuevoId().slice(0, 8), estado: "publicado", creado_en: ahora(), ...datos };
  guardar({ ...e, torneos: [...e.torneos, t] });
  return t;
}
export function borrarTorneo(id) {
  const e = leer();
  guardar({
    ...e,
    torneos: e.torneos.filter((t) => t.id !== id),
    inscripciones: e.inscripciones.filter((i) => i.torneo_id !== id),
  });
}

// ---------------------------------------------------------------- inscripciones
export const inscripciones = (torneoId) =>
  leer().inscripciones.filter((i) => !torneoId || i.torneo_id === torneoId);

export function inscribir(datos) {
  const e = leer();
  const ins = { id: nuevoId(), estado_pago: "pendiente", creado_en: ahora(), ...datos };
  guardar({ ...e, inscripciones: [...e.inscripciones, ins] });
  return ins;
}
export function cambiarEstadoPago(id, estado, motivo = "") {
  const e = leer();
  guardar({
    ...e,
    inscripciones: e.inscripciones.map((i) =>
      i.id === id ? { ...i, estado_pago: estado, motivo, validado_por: "organizador (demo)", validado_en: ahora() } : i,
    ),
  });
}
// Derecho de supresión (Ley 29733): borra la inscripción y su voucher.
export async function suprimirInscripcion(id) {
  const e = leer();
  guardar({ ...e, inscripciones: e.inscripciones.filter((i) => i.id !== id) });
  await borrarVoucher(id);
}
// Lista pública: solo nombre, categoría y club (sección 9.2 de la guía).
export const listaPublica = (torneoId) =>
  inscripciones(torneoId)
    .filter((i) => i.estado_pago !== "rechazado")
    .map((i) => ({ nombre: `${i.nombres} ${i.apellidos}`, categoria: i.categoria, club: i.club || "—", validado: i.estado_pago === "validado" }));

export function csvInscritos(torneoId) {
  const filas = [["Apellidos", "Nombres", "Fecha de nacimiento", "Categoría", "Nivel", "Club", "FIDE ID", "Usuario Lichess", "Estado de pago"]];
  for (const i of inscripciones(torneoId)) {
    filas.push([i.apellidos, i.nombres, i.fecha_nacimiento, i.categoria, i.nivel ?? "", i.club ?? "", i.fide_id ?? "", i.lichess ?? "", i.estado_pago]);
  }
  // BOM para que Excel abra bien las tildes.
  return "﻿" + filas.map((f) => f.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

// ---------------------------------------------------------------- vouchers (IndexedDB)
function bd() {
  return new Promise((ok, mal) => {
    const req = indexedDB.open("mokewa-demo", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("vouchers");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}
async function tx(modo, fn) {
  const db = await bd();
  return new Promise((ok, mal) => {
    const t = db.transaction("vouchers", modo);
    const r = fn(t.objectStore("vouchers"));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
  });
}
export const guardarVoucher = (id, blob) => tx("readwrite", (s) => s.put(blob, id));
export const leerVoucher = (id) => tx("readonly", (s) => s.get(id));
export const borrarVoucher = (id) => tx("readwrite", (s) => s.delete(id)).catch(() => {});

export const TIPOS_VOUCHER = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_VOUCHER = 5 * 1024 * 1024;

// ---------------------------------------------------------------- noticias y resultados
export const noticias = () => [...leer().noticias].sort((a, b) => b.fecha.localeCompare(a.fecha));
export function crearNoticia(n) {
  const e = leer();
  guardar({ ...e, noticias: [...e.noticias, { id: nuevoId(), fecha: ahora().slice(0, 10), ...n }] });
}
export function borrarNoticia(id) {
  const e = leer();
  guardar({ ...e, noticias: e.noticias.filter((n) => n.id !== id) });
}
export const resultadosPublicados = () => leer().resultados;
export function publicarResultados(clave, datos) {
  const e = leer();
  guardar({ ...e, resultados: { ...e.resultados, [clave]: { ...datos, publicado_en: ahora() } } });
}
export function borrarResultados(clave) {
  const e = leer();
  const r = { ...e.resultados };
  delete r[clave];
  guardar({ ...e, resultados: r });
}

// Lee un CSV exportado de Swiss-Manager u hoja de cálculo: detecta ; , o tabulador.
export function leerCsvResultados(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const sep = [";", "\t", ","].sort((a, b) => lineas[0].split(b).length - lineas[0].split(a).length)[0];
  const partir = (l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const cab = partir(lineas[0]).map((c) => c.toLowerCase());
  const col = (...nombres) => cab.findIndex((c) => nombres.some((n) => c.includes(n)));
  const iPuesto = col("puesto", "rk", "rank", "pos");
  const iNombre = col("nombre", "name", "jugador", "player");
  const iPuntos = col("puntos", "pts", "points");
  const iCat = col("categ", "cat", "group");
  if (iNombre < 0) return [];
  return lineas
    .slice(1)
    .map((l, k) => {
      const c = partir(l);
      return {
        puesto: iPuesto >= 0 ? Number(c[iPuesto]) || k + 1 : k + 1,
        nombre: c[iNombre],
        puntos: iPuntos >= 0 ? Number(String(c[iPuntos]).replace(",", ".")) : null,
        categoria: iCat >= 0 ? c[iCat] : "",
      };
    })
    .filter((f) => f.nombre);
}

// ---------------------------------------------------------------- datos de prueba
function voucherDePrueba(n, monto) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560">
<rect width="360" height="560" fill="#742284"/><rect x="20" y="90" width="320" height="400" rx="18" fill="#fff"/>
<text x="180" y="60" fill="#fff" font-family="Arial" font-size="28" font-weight="700" text-anchor="middle">VOUCHER DE PRUEBA</text>
<text x="180" y="170" fill="#742284" font-family="Arial" font-size="20" text-anchor="middle">¡Pago realizado!</text>
<text x="180" y="240" fill="#222" font-family="Arial" font-size="46" font-weight="700" text-anchor="middle">S/ ${monto}</text>
<text x="180" y="300" fill="#555" font-family="Arial" font-size="16" text-anchor="middle">Operación de ejemplo n.º ${100000 + n * 7919}</text>
<text x="180" y="340" fill="#555" font-family="Arial" font-size="16" text-anchor="middle">Destino: Ajedrez Club Mokewa (demo)</text>
<text x="180" y="440" fill="#a00" font-family="Arial" font-size="15" text-anchor="middle">Imagen generada para la demostración</text>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function sembrarDemo({ forzar = false } = {}) {
  const e = leer();
  if (e.sembrado && !forzar) return;
  const base = [
    ["Valeria", "Quispe Mamani", "2016-03-14", "Básico", "Colegio de ejemplo A"],
    ["Mateo", "Flores Ticona", "2013-08-02", "Intermedio", "Ajedrez Club Mokewa"],
    ["Camila", "Huanca Pari", "2011-11-20", "Avanzado", "Ajedrez Club Mokewa"],
    ["Diego", "Condori Apaza", "2018-05-09", "Básico", "Colegio de ejemplo B"],
    ["Luciana", "Vargas Chambi", "2009-01-27", "Intermedio", "Independiente"],
    ["Sebastián", "Mendoza Laura", "2014-12-03", "Avanzado", "Ajedrez Club Mokewa"],
  ];
  const estados = ["pendiente", "pendiente", "validado", "pendiente", "validado", "rechazado"];
  const nuevas = base.map(([nombres, apellidos, fecha, nivel, club], k) => ({
    id: nuevoId(),
    torneo_id: TORNEO_VERANO.id,
    prueba: true,
    nombres,
    apellidos,
    fecha_nacimiento: fecha,
    categoria: categoriaPara(fecha, TORNEO_VERANO.anio),
    nivel,
    club,
    tutor_nombre: "Tutor de prueba",
    tutor_telefono: "900000000",
    tutor_correo: "tutor.prueba@example.com",
    consentimiento: true,
    consentimiento_fecha: ahora(),
    estado_pago: estados[k],
    motivo: estados[k] === "rechazado" ? "El monto no coincide con la inscripción" : "",
    creado_en: new Date(Date.now() - (6 - k) * 3600_000).toISOString(),
  }));
  // Primero los comprobantes y después el estado: así ninguna inscripción queda sin imagen
  // si el usuario cambia de página a mitad del guardado.
  for (const [k, i] of nuevas.entries()) await guardarVoucher(i.id, voucherDePrueba(k + 1, 20)).catch(() => {});
  const actual = leer();
  if (actual.sembrado && !forzar) return;
  guardar({ ...actual, inscripciones: [...actual.inscripciones.filter((i) => !i.prueba), ...nuevas], sembrado: true });
}

export async function reiniciarDemo() {
  for (const i of leer().inscripciones) await borrarVoucher(i.id);
  cache = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO));
}

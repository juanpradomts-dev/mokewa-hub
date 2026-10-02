// Capa de datos de la web, con dos motores y la misma interfaz:
//
// - DEMO (sin base de datos): todo vive en este navegador (localStorage + IndexedDB para los
//   vouchers), así el club prueba inscripciones y validaciones sin tocar datos reales.
// - WEB OFICIAL (con PUBLIC_SUPABASE_URL): los datos vienen de Supabase (nube.js, que solo se
//   descarga en ese caso) y se guardan en el mismo estado en memoria. Las lecturas siguen siendo
//   inmediatas; las escrituras devuelven una promesa (las páginas hacen «await», que en la demo
//   no cambia nada).
// - WEB OFICIAL SIN BASE DE DATOS: solo lo publicado (contenido.json). No lee ni escribe nada del
//   navegador, así lo que alguien probó en la demo (mismo dominio) nunca aparece en la web oficial.

import contenidoBase from "../data/contenido.json";
import { CATEGORIAS } from "./categorias.js";
import { enlaceContacto, numeroWhatsapp } from "./contacto.js";
import { hayBaseDeDatos } from "./backend.js";
import { esProduccion } from "./contenido.js";
import personalDemo from "../data/personal-demo.json";
import { claveJugador } from "./metricas.js";
import { visitasDemo, borrarVisitasDemo } from "./conteo.js";

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
const vacio = () => ({ version: 1, contenido: {}, torneos: [], inscripciones: [], noticias: [], resultados: {}, personal: null, sembrado: false });

// ---------------------------------------------------------------- motor «nube» (web oficial)
const NUBE = hayBaseDeDatos;
const estadoNube = { ...vacio(), sembrado: true, publicos: [], mias: [] };
let moduloNube = null;
const nube = () => (moduloNube ??= import("./nube.js"));
const avisar = () => window.dispatchEvent(new CustomEvent(EVENTO));
// Aplica un cambio al estado en memoria y avisa a la página para que se vuelva a pintar.
const cambiar = (fn) => {
  fn(estadoNube);
  avisar();
};
let publicoListo = Promise.resolve();
if (NUBE && typeof window !== "undefined") {
  publicoListo = nube()
    .then((n) => n.cargarPublico())
    .then((d) => cambiar((e) => Object.assign(e, d)))
    .catch((e) => console.warn("No se pudo leer la base de datos del club:", e));
}
// Espera a que lleguen los datos públicos (en la demo ya están).
export const listo = () => publicoListo;
export const hayNube = NUBE;

let cache = null;
const FIJO = esProduccion && !NUBE;
function leer() {
  if (NUBE) return estadoNube;
  if (cache) return cache;
  if (FIJO) return (cache = { ...vacio(), sembrado: true });
  try {
    cache = { ...vacio(), ...JSON.parse(localStorage.getItem(CLAVE) ?? "null") };
  } catch {
    cache = vacio();
  }
  return cache;
}
function guardar(estado) {
  cache = estado;
  if (FIJO) return window.dispatchEvent(new CustomEvent(EVENTO));
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
    if (!FIJO && e.key === CLAVE) {
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
  if (NUBE) return nube().then((n) => n.guardarContenido(valores)).then(() => cambiar((e) => {
    for (const [k, v] of Object.entries(valores)) v == null ? delete e.contenido[k] : (e.contenido[k] = v);
  }));
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
  // Listas (un elemento por línea): lo confirmado o, en la demo, la propuesta.
  for (const ul of raiz.querySelectorAll("[data-lista]")) {
    const texto = contenido(ul.dataset.lista) ?? ul.dataset.propuesta ?? "";
    const items = texto.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
    ul.replaceChildren(...items.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    ul.hidden = items.length === 0;
  }
  // Bloques que solo se muestran cuando TODOS sus datos están confirmados (p. ej. horario + precio).
  const todos = (lista) => lista.split(/\s+/).filter(Boolean).every((c) => contenido(c));
  for (const el of raiz.querySelectorAll("[data-si-campos]")) el.hidden = !todos(el.dataset.siCampos);
  for (const el of raiz.querySelectorAll("[data-sin-campo]")) el.hidden = !!contenido(el.dataset.sinCampo);
  for (const a of raiz.querySelectorAll("[data-segun]")) {
    a.dataset.accion = todos(a.dataset.segun) ? a.dataset.accionCon : a.dataset.accionSin;
  }
  const conClase = !!contenido("clase_prueba");
  for (const a of raiz.querySelectorAll("[data-cta]")) {
    a.dataset.accion = conClase ? "Clase de prueba" : "Pide informes";
    a.dataset.mensaje = conClase
      ? "Hola, quisiera agendar una clase de prueba de ajedrez."
      : "Hola, quisiera información sobre las clases de ajedrez.";
  }
  const wa = contenido("whatsapp");
  // Botón flotante de WhatsApp: con número, abre el chat directo.
  const numero = numeroWhatsapp(wa);
  for (const a of raiz.querySelectorAll("[data-wsp]")) {
    if (numero) a.href = `https://wa.me/${numero}?text=${encodeURIComponent(a.dataset.mensaje ?? "")}`;
  }
  for (const a of raiz.querySelectorAll("[data-contacto]")) {
    const e = enlaceContacto({ correo: contenido("correo"), whatsapp: wa }, a.dataset.mensaje, a.dataset.accion);
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
  if (NUBE) return nube().then((n) => n.crearTorneo(datos)).then((t) => (cambiar((e) => e.torneos.push(t)), t));
  const e = leer();
  const t = { id: nuevoId().slice(0, 8), estado: "publicado", creado_en: ahora(), ...datos };
  guardar({ ...e, torneos: [...e.torneos, t] });
  return t;
}
export function borrarTorneo(id) {
  if (NUBE) return nube().then((n) => n.borrarTorneo(id)).then(() => cambiar((e) => {
    e.torneos = e.torneos.filter((t) => t.id !== id);
    e.inscripciones = e.inscripciones.filter((i) => i.torneo_id !== id);
  }));
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
  if (NUBE) return nube().then((n) => n.inscribir(datos)).then((ins) => {
    cambiar((e) => {
      e.mias.push({ id: ins.id, torneo_id: ins.torneo_id, nombres: ins.nombres, apellidos: ins.apellidos, estado_pago: "pendiente", motivo: "" });
      e.publicos.push({ torneo_id: ins.torneo_id, nombre: `${ins.nombres} ${ins.apellidos}`, categoria: ins.categoria, club: ins.club || "—", validado: false });
    });
    return ins;
  });
  const e = leer();
  // Igual que la base de datos: la misma persona no se inscribe dos veces en un torneo.
  if (e.inscripciones.some((i) => i.torneo_id === datos.torneo_id && claveJugador(i) === claveJugador(datos)))
    throw new Error("Este jugador ya está inscrito en este torneo.");
  const ins = { id: nuevoId(), estado_pago: "pendiente", creado_en: ahora(), ...datos };
  guardar({ ...e, inscripciones: [...e.inscripciones, ins] });
  return ins;
}
export function cambiarEstadoPago(id, estado, motivo = "") {
  if (NUBE) return nube().then((n) => n.cambiarEstadoPago(id, estado, motivo)).then(() => cambiar((e) => {
    e.inscripciones = e.inscripciones.map((i) => (i.id === id ? { ...i, estado_pago: estado, motivo } : i));
  }));
  const e = leer();
  guardar({
    ...e,
    inscripciones: e.inscripciones.map((i) =>
      i.id === id ? { ...i, estado_pago: estado, motivo, validado_por: "organizador (demo)", validado_en: ahora() } : i,
    ),
  });
}
// Derecho de supresión (Ley 29733): borra al jugador en todos los torneos, con sus comprobantes.
export async function suprimirInscripcion(id) {
  if (NUBE) {
    const borradas = await (await nube()).suprimirInscripcion(id);
    return cambiar((e) => (e.inscripciones = e.inscripciones.filter((i) => !borradas.includes(i.id))));
  }
  const e = leer();
  const elegida = e.inscripciones.find((i) => i.id === id);
  const borradas = elegida ? e.inscripciones.filter((i) => claveJugador(i) === claveJugador(elegida)).map((i) => i.id) : [id];
  guardar({ ...e, inscripciones: e.inscripciones.filter((i) => !borradas.includes(i.id)) });
  for (const x of borradas) await borrarVoucher(x);
}
// Lista pública: solo nombre, categoría y club (sección 9.2 de la guía).
export const listaPublica = (torneoId) =>
  NUBE ? estadoNube.publicos.filter((i) => i.torneo_id === torneoId) : inscripciones(torneoId)
    .filter((i) => i.estado_pago !== "rechazado")
    .map((i) => ({ nombre: `${i.nombres} ${i.apellidos}`, categoria: i.categoria, club: i.club || "—", validado: i.estado_pago === "validado" }));

// Las inscripciones hechas desde este navegador (para que el padre vea el estado de su pago).
export const misInscripciones = (torneoId) =>
  NUBE ? estadoNube.mias.filter((i) => i.torneo_id === torneoId) : inscripciones(torneoId).filter((i) => !i.prueba);

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
export const guardarVoucher = (id, blob) => (NUBE ? nube().then((n) => n.subirVoucher(id, blob)) : tx("readwrite", (s) => s.put(blob, id)));
export const leerVoucher = (id) => (NUBE ? nube().then((n) => n.leerVoucher(id)) : tx("readonly", (s) => s.get(id)));
export const borrarVoucher = (id) => (NUBE ? Promise.resolve() : tx("readwrite", (s) => s.delete(id)).catch(() => {}));

export const TIPOS_VOUCHER = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_VOUCHER = 5 * 1024 * 1024;

// ---------------------------------------------------------------- noticias y resultados
export const noticias = () => [...leer().noticias].sort((a, b) => b.fecha.localeCompare(a.fecha));
export function crearNoticia(n) {
  if (NUBE) return nube().then((m) => m.crearNoticia(n)).then((x) => cambiar((e) => e.noticias.unshift(x)));
  const e = leer();
  guardar({ ...e, noticias: [...e.noticias, { id: nuevoId(), fecha: ahora().slice(0, 10), ...n }] });
}
export function borrarNoticia(id) {
  if (NUBE) return nube().then((m) => m.borrarNoticia(id)).then(() => cambiar((e) => (e.noticias = e.noticias.filter((x) => x.id !== id))));
  const e = leer();
  guardar({ ...e, noticias: e.noticias.filter((n) => n.id !== id) });
}
export const resultadosPublicados = () => leer().resultados;
export function publicarResultados(clave, datos) {
  if (NUBE) return nube().then((n) => n.publicarResultados(clave, datos)).then(() => cambiar((e) => (e.resultados = { ...e.resultados, [clave]: { ...datos, publicado_en: ahora() } })));
  const e = leer();
  guardar({ ...e, resultados: { ...e.resultados, [clave]: { ...datos, publicado_en: ahora() } } });
}
export function borrarResultados(clave) {
  if (NUBE) return nube().then((n) => n.borrarResultados(clave)).then(() => cambiar((e) => {
    const r = { ...e.resultados };
    delete r[clave];
    e.resultados = r;
  }));
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
function voucherDePrueba(n) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560">
<rect width="360" height="560" fill="#5a2a06"/><rect x="20" y="90" width="320" height="400" rx="18" fill="#fff"/>
<text x="180" y="60" fill="#fff" font-family="Arial" font-size="28" font-weight="700" text-anchor="middle">VOUCHER DE PRUEBA</text>
<text x="180" y="170" fill="#5a2a06" font-family="Arial" font-size="20" text-anchor="middle">Comprobante de prueba</text>
<text x="180" y="240" fill="#222" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle">Monto de prueba</text>
<text x="180" y="300" fill="#555" font-family="Arial" font-size="16" text-anchor="middle">Operación de ejemplo n.º ${100000 + n * 7919}</text>
<text x="180" y="340" fill="#555" font-family="Arial" font-size="16" text-anchor="middle">Destino: Ajedrez Club Mokewa (demo)</text>
<text x="180" y="440" fill="#a00" font-family="Arial" font-size="15" text-anchor="middle">Imagen generada para la demostración</text>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function sembrarDemo({ forzar = false } = {}) {
  if (NUBE || FIJO) return; // la web oficial nunca siembra datos de prueba
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
  const DIAS_PRUEBA = [26, 3, 17, 0.2, 9, 5];
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
    // Repartidas en las últimas semanas, para que las métricas del panel tengan una tendencia que mostrar.
    creado_en: new Date(Date.now() - DIAS_PRUEBA[k] * 864e5).toISOString(),
    ...(estados[k] !== "pendiente" ? { validado_por: "organizador (demo)", validado_en: new Date(Date.now() - DIAS_PRUEBA[k] * 864e5 + (k + 2) * 36e5).toISOString() } : {}),
  }));
  // Primero los comprobantes y después el estado: así ninguna inscripción queda sin imagen
  // si el usuario cambia de página a mitad del guardado.
  for (const [k, i] of nuevas.entries()) await guardarVoucher(i.id, voucherDePrueba(k + 1)).catch(() => {});
  const actual = leer();
  if (actual.sembrado && !forzar) return;
  guardar({ ...actual, inscripciones: [...actual.inscripciones.filter((i) => !i.prueba), ...nuevas], sembrado: true });
}

export async function reiniciarDemo() {
  if (NUBE || FIJO) return;
  for (const i of leer().inscripciones) await borrarVoucher(i.id);
  borrarVisitasDemo();
  cache = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO));
}

// ---------------------------------------------------------------- acceso al panel y roles
// Roles: «admin» (todo) y «entrenador» (torneos, resultados y noticias). En la web oficial los impone la
// base de datos (RLS); en la demo el acceso es una simulación con cuentas de prueba (personal-demo.json).
export const ROLES = { admin: "Administrador", entrenador: "Entrenador" };
const SESION = "mokewa-panel";
const cuentasDemo = () => leer().personal ?? personalDemo.cuentas;
const sinClave = ({ correo, nombre, rol }) => ({ correo, nombre, rol });
function guardarCuentasDemo(lista) {
  guardar({ ...leer(), personal: lista });
}

export async function sesionPanel() {
  if (NUBE) return (await nube()).sesion();
  let correo = null;
  try {
    correo = sessionStorage.getItem(SESION);
  } catch {}
  const c = cuentasDemo().find((x) => x.correo === correo);
  return c ? sinClave(c) : null;
}
export async function entrarPanel(correo, clave) {
  if (NUBE) return (await nube()).entrar(correo, clave);
  const c = cuentasDemo().find((x) => x.correo.toLowerCase() === String(correo).trim().toLowerCase() && x.clave === clave);
  if (!c) throw new Error("Correo o contraseña incorrectos.");
  try {
    sessionStorage.setItem(SESION, c.correo);
  } catch {}
  return sinClave(c);
}
// Primer ingreso del dueño en la web oficial: activa su cuenta como administrador (supabase/migrations).
export async function reclamarAdmin(nombre) {
  nombre = String(nombre ?? "").trim();
  if (!nombre) throw new Error("Escribe tu nombre.");
  if (!NUBE) throw new Error("En la demo el administrador ya existe.");
  return (await nube()).reclamarAdmin(nombre);
}
export async function cambiarClave(nueva, repetida) {
  if (String(nueva ?? "").length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (nueva !== repetida) throw new Error("Las dos contraseñas no coinciden.");
  if (NUBE) return (await nube()).cambiarClave(nueva);
  let correo = null;
  try {
    correo = sessionStorage.getItem(SESION);
  } catch {}
  guardarCuentasDemo(cuentasDemo().map((x) => (x.correo === correo ? { ...x, clave: nueva } : x)));
}
// Visitas de la web desde un día («AAAA-MM-DD»; vacío = todas). En la demo, las de este navegador.
export async function cargarVisitas(desde = "") {
  if (NUBE) return (await nube()).cargarVisitas(desde);
  return visitasDemo().filter((f) => !desde || f.dia >= desde);
}
export async function salirPanel() {
  if (NUBE) return (await nube()).salir();
  try {
    sessionStorage.removeItem(SESION);
  } catch {}
}
// Carga las inscripciones con los datos de contacto (solo el admin; en la demo ya están).
export async function cargarPanel() {
  if (!NUBE) return;
  const lista = await (await nube()).cargarPanel();
  cambiar((e) => (e.inscripciones = lista));
}

// Personal con acceso al panel (solo el admin lo ve y lo cambia).
export async function listaPersonal() {
  return NUBE ? (await nube()).personal() : cuentasDemo().map(sinClave);
}
export async function darAcceso({ correo, nombre, rol, clave }) {
  correo = String(correo ?? "").trim().toLowerCase();
  nombre = String(nombre ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Revisa el correo.");
  if (!nombre) throw new Error("Escribe el nombre.");
  if (!ROLES[rol]) throw new Error("Elige un rol.");
  if (NUBE) return (await nube()).darAcceso(correo, nombre, rol);
  const lista = cuentasDemo();
  const existe = lista.find((x) => x.correo === correo);
  if (existe && existe.rol === "admin" && rol !== "admin" && lista.filter((x) => x.rol === "admin").length === 1)
    throw new Error("Debe quedar al menos un administrador.");
  if (!existe && String(clave ?? "").length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  guardarCuentasDemo(existe ? lista.map((x) => (x.correo === correo ? { ...x, nombre, rol } : x)) : [...lista, { correo, nombre, rol, clave }]);
}
export async function quitarAcceso(correo, yo) {
  if (correo === yo) throw new Error("No puedes quitarte el acceso a ti mismo.");
  if (NUBE) return (await nube()).quitarAcceso(correo);
  const lista = cuentasDemo();
  const c = lista.find((x) => x.correo === correo);
  if (c?.rol === "admin" && lista.filter((x) => x.rol === "admin").length === 1) throw new Error("Debe quedar al menos un administrador.");
  guardarCuentasDemo(lista.filter((x) => x.correo !== correo));
}

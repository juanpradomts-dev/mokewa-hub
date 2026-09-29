// Panel del organizador (demo). Todo pasa por store.js; en producción, por Supabase con RLS.
import {
  CAMPOS, contenido, guardarContenido, pendientesDeConfirmar, todosLosTorneos, torneosCreados, crearTorneo, borrarTorneo,
  inscripciones, cambiarEstadoPago, suprimirInscripcion, leerVoucher, csvInscritos, noticias, crearNoticia, borrarNoticia,
  resultadosPublicados, publicarResultados, borrarResultados, leerCsvResultados, sembrarDemo, reiniciarDemo, alCambiar,
  TORNEO_VERANO,
} from "./store.js";
import { esc } from "./html.js";
import contenidoBaseCompleto from "../data/contenido.json";

const $ = (id) => document.getElementById(id);
const base = document.body.dataset.base ?? "";
const SESION = "mokewa-panel";

// ------------------------------------------------------------------ entrada
function entrar() {
  try {
    sessionStorage.setItem(SESION, "1");
  } catch {}
  $("puerta").hidden = true;
  $("panel").hidden = false;
  sembrarDemo().then(pintarTodo);
  pintarTodo();
}
$("entrar").addEventListener("click", entrar);
$("salir").addEventListener("click", () => {
  try {
    sessionStorage.removeItem(SESION);
  } catch {}
  location.reload();
});

// ------------------------------------------------------------------ pestañas
const pestanas = [...document.querySelectorAll('[role="tab"]')];
function abrir(tab, enfocar = false) {
  for (const t of pestanas) {
    const activa = t === tab;
    t.setAttribute("aria-selected", String(activa));
    t.tabIndex = activa ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !activa;
  }
  if (enfocar) tab.focus();
  history.replaceState(null, "", `#${tab.id.slice(2)}`);
}
pestanas.forEach((t, i) => {
  t.addEventListener("click", () => abrir(t));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") abrir(pestanas[(i + 1) % pestanas.length], true);
    if (e.key === "ArrowLeft") abrir(pestanas[(i - 1 + pestanas.length) % pestanas.length], true);
  });
});
const inicial = pestanas.find((t) => t.id === `t-${location.hash.slice(1)}`);
if (inicial) abrir(inicial);

// ------------------------------------------------------------------ resumen
const CINCO = ["horario_basico", "precio_mensual", "sede", "whatsapp"];
function pintarResumen() {
  const todas = inscripciones();
  const pend = todas.filter((i) => i.estado_pago === "pendiente").length;
  const val = todas.filter((i) => i.estado_pago === "validado").length;
  const faltan = pendientesDeConfirmar();
  const total = Object.keys(CAMPOS).length;
  $("kpis").innerHTML = [
    [todas.length, "inscripciones recibidas"],
    [pend, "pagos por validar"],
    [val, "pagos validados"],
    [`${total - faltan.length}/${total}`, "datos del club confirmados"],
  ]
    .map(([n, t]) => `<div class="cifra"><strong>${n}</strong><span>${t}</span></div>`)
    .join("");
  $("globo-pendientes").textContent = pend || "";
  $("globo-datos").textContent = faltan.length || "";

  const items = [
    ...CINCO.map((c) => [CAMPOS[c].etiqueta, !faltan.includes(c)]),
    ["Horarios de los niveles intermedio y avanzado", !faltan.includes("horario_intermedio") && !faltan.includes("horario_avanzado")],
    ["Logo en alta calidad y autorización para usarlo", false],
    ["Número de Yape o Plin para cobrar", !faltan.includes("yape")],
    ["Entrenadores: nombres y títulos", !faltan.includes("entrenadores")],
    ["Misión y visión aprobadas por el club", !faltan.includes("mision") && !faltan.includes("vision")],
    ["Fotos del club (con autorización escrita de los padres)", !faltan.includes("fotos")],
    ["¿Ofrecen clase de prueba? (si la hay, el botón principal lo dice)", !faltan.includes("clase_prueba")],
  ];
  $("checklist").innerHTML = items
    .map(([t, ok]) => `<li class="${ok ? "hecho" : ""}"><span aria-hidden="true">${ok ? "✓" : "○"}</span> ${esc(t)}${ok ? '<span class="visually-hidden"> (listo)</span>' : ""}</li>`)
    .join("");
}

// ------------------------------------------------------------------ inscripciones
const ESTADOS = {
  pendiente: ["Pendiente", "etiqueta-ejemplo"],
  validado: ["Validado", "etiqueta-ok"],
  rechazado: ["Rechazado", "etiqueta-error"],
};
const MOTIVOS = ["El monto no coincide con la inscripción", "La imagen no se lee bien", "No encontramos el pago", "Pago duplicado"];
const urlsVoucher = new Map();

function pintarSelectTorneos() {
  const sel = $("i-torneo");
  const actual = sel.value || TORNEO_VERANO.id;
  sel.innerHTML = todosLosTorneos()
    .map((t) => `<option value="${esc(t.id)}">${esc(t.nombre)}${t.ejemplo ? " (ejemplo)" : ""}</option>`)
    .join("");
  sel.value = todosLosTorneos().some((t) => t.id === actual) ? actual : TORNEO_VERANO.id;
}

async function miniatura(id) {
  if (urlsVoucher.has(id)) return urlsVoucher.get(id);
  const blob = await leerVoucher(id).catch(() => null);
  const info = blob ? { url: URL.createObjectURL(blob), tipo: blob.type } : null;
  if (info) urlsVoucher.set(id, info);
  return info;
}

async function pintarInscripciones() {
  pintarSelectTorneos();
  const tid = $("i-torneo").value;
  const estado = $("i-estado").value;
  const lista = inscripciones(tid)
    .filter((i) => !estado || i.estado_pago === estado)
    .sort((a, b) => (a.estado_pago === "pendiente" ? -1 : 0) - (b.estado_pago === "pendiente" ? -1 : 0) || b.creado_en.localeCompare(a.creado_en));
  const todas = inscripciones(tid);
  $("i-resumen").textContent = `${todas.length} inscritos · ${todas.filter((i) => i.estado_pago === "pendiente").length} por validar · ${todas.filter((i) => i.estado_pago === "validado").length} validados`;
  if (!lista.length) {
    $("i-lista").innerHTML = `<p class="tarjeta suave">No hay inscripciones con ese filtro.</p>`;
    return;
  }
  const html = [];
  for (const i of lista) {
    const v = await miniatura(i.id);
    const [txt, cls] = ESTADOS[i.estado_pago];
    const img = v
      ? v.tipo === "application/pdf"
        ? `<span class="pdf">PDF</span>`
        : `<img src="${v.url}" alt="Comprobante de ${esc(i.nombres)}" loading="lazy" />`
      : `<span class="pdf">—</span>`;
    const hora = new Date(i.creado_en).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    html.push(`<article class="tarjeta inscripcion" data-id="${esc(i.id)}">
      <button class="voucher" type="button" data-accion="ver" aria-label="Ver comprobante de ${esc(i.nombres)} ${esc(i.apellidos)}">${img}</button>
      <div class="ins-datos">
        <div class="ins-titulo"><strong>${esc(i.nombres)} ${esc(i.apellidos)}</strong> <span class="etiqueta ${cls}">${txt}</span>${i.prueba ? ' <span class="etiqueta">dato de prueba</span>' : ""}</div>
        <p>${esc(i.categoria)} · ${esc(i.nivel)} · ${esc(i.club || "sin club")}</p>
        <p class="suave">Tutor: ${esc(i.tutor_nombre)} · ${esc(i.tutor_telefono)} · ${esc(i.tutor_correo)}</p>
        <p class="suave">Recibida: ${hora} · consentimiento ${i.consentimiento ? "✓" : "✗"}${i.motivo ? ` · Motivo: ${esc(i.motivo)}` : ""}</p>
        <div class="grupo-botones acciones">
          ${i.estado_pago !== "validado" ? `<button class="boton boton-primario boton-chico" type="button" data-accion="validar">Validar pago</button>` : ""}
          ${i.estado_pago !== "rechazado" ? `<label class="visually-hidden" for="m-${esc(i.id)}">Motivo del rechazo</label><select id="m-${esc(i.id)}" class="motivo">${MOTIVOS.map((m) => `<option>${esc(m)}</option>`).join("")}</select><button class="boton boton-secundario boton-chico" type="button" data-accion="rechazar">Rechazar</button>` : ""}
          ${i.estado_pago !== "pendiente" ? `<button class="boton boton-secundario boton-chico" type="button" data-accion="pendiente">Volver a pendiente</button>` : ""}
          <button class="boton boton-secundario boton-chico peligro" type="button" data-accion="suprimir">Borrar datos</button>
        </div>
      </div></article>`);
  }
  $("i-lista").innerHTML = html.join("");
}

$("i-lista").addEventListener("click", async (e) => {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const tarjeta = boton.closest("[data-id]");
  const id = tarjeta.dataset.id;
  const accion = boton.dataset.accion;
  if (accion === "validar") cambiarEstadoPago(id, "validado");
  if (accion === "pendiente") cambiarEstadoPago(id, "pendiente");
  if (accion === "rechazar") cambiarEstadoPago(id, "rechazado", tarjeta.querySelector(".motivo").value);
  if (accion === "suprimir") {
    if (!confirm("¿Borrar todos los datos de esta inscripción y su comprobante? (derecho de supresión, Ley 29733)")) return;
    await suprimirInscripcion(id);
  }
  if (accion === "ver") verVoucher(id);
});
$("i-torneo").addEventListener("change", pintarInscripciones);
$("i-estado").addEventListener("change", pintarInscripciones);
$("i-csv").addEventListener("click", () => {
  const tid = $("i-torneo").value;
  const blob = new Blob([csvInscritos(tid)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inscritos-${tid}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

async function verVoucher(id) {
  const v = await miniatura(id);
  const i = inscripciones().find((x) => x.id === id);
  $("visor-titulo").textContent = `Comprobante · ${i ? `${i.nombres} ${i.apellidos}` : ""}`;
  $("visor-cuerpo").innerHTML = !v
    ? `<p>Sin comprobante.</p>`
    : v.tipo === "application/pdf"
      ? `<iframe src="${v.url}" title="Comprobante en PDF"></iframe>`
      : `<img src="${v.url}" alt="Comprobante de pago" />`;
  $("visor").showModal();
}
$("visor-cerrar").addEventListener("click", () => $("visor").close());
$("visor").addEventListener("click", (e) => e.target === $("visor") && $("visor").close());

// ------------------------------------------------------------------ torneos
const abiertoTorneo = Date.now();
$("form-torneo").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const nombre = String(f.get("nombre") ?? "").trim();
  if (!nombre) return;
  const fecha = String(f.get("fecha") || "");
  const t = crearTorneo({
    nombre,
    modalidad: f.get("modalidad"),
    fecha,
    anio: fecha ? Number(fecha.slice(0, 4)) : new Date().getFullYear(),
    ritmo: String(f.get("ritmo") || "").trim(),
    cupo: String(f.get("cupo") || "").trim(),
    costo: String(f.get("costo") || "").trim(),
    sede: String(f.get("sede") || "").trim(),
    categorias: f.getAll("categorias"),
    bases: String(f.get("bases") || "").trim(),
    foto: String(f.get("foto") || "").trim(),
    descripcion: String(f.get("descripcion") || "").trim(),
  });
  const seg = Math.round((Date.now() - abiertoTorneo) / 1000);
  e.target.reset();
  $("tr-aviso").innerHTML = `Publicado «${esc(t.nombre)}» en ${seg >= 60 ? `${Math.floor(seg / 60)} min ${seg % 60} s` : `${seg} s`}. <a href="${base}/torneos/" target="_blank">Verlo en la web ↗</a>`;
});
function pintarTorneos() {
  const lista = torneosCreados();
  const filas = [TORNEO_VERANO, ...lista].map((t) => {
    const n = inscripciones(t.id).length;
    return `<div class="tarjeta fila-simple"><div><strong>${esc(t.nombre)}</strong>${t.ejemplo ? ' <span class="etiqueta etiqueta-ejemplo">ejemplo</span>' : ""}<br><span class="suave">${esc(t.modalidad)}${t.fecha ? " · " + esc(t.fecha) : ""} · ${n} ${n === 1 ? "inscrito" : "inscritos"}</span></div>
      <div class="grupo-botones"><a class="boton boton-secundario boton-chico" href="${base}/torneos/verano-2027/${t.ejemplo ? "" : `?t=${encodeURIComponent(t.id)}`}" target="_blank">Ver ↗</a>
      ${t.ejemplo ? "" : `<button class="boton boton-secundario boton-chico peligro" type="button" data-borrar-torneo="${esc(t.id)}">Borrar</button>`}</div></div>`;
  });
  $("tr-lista").innerHTML = filas.join("");
}
$("tr-lista").addEventListener("click", (e) => {
  const id = e.target.closest("[data-borrar-torneo]")?.dataset.borrarTorneo;
  if (id && confirm("¿Borrar este torneo y sus inscripciones de prueba?")) borrarTorneo(id);
});

// ------------------------------------------------------------------ resultados
let filasResultados = [];
let origenResultados = "";
function vistaPrevia() {
  $("r-publicar").disabled = !filasResultados.length;
  $("r-vista").innerHTML = filasResultados.length
    ? `<div class="tabla-envoltura"><table><thead><tr><th class="num">Puesto</th><th>Jugador</th><th>Cat.</th><th class="num">Puntos</th></tr></thead><tbody>${filasResultados
        .slice(0, 50)
        .map((f) => `<tr><td class="num">${f.puesto}</td><td>${esc(f.nombre)}</td><td>${esc(f.categoria || "")}</td><td class="num">${f.puntos ?? "—"}</td></tr>`)
        .join("")}</tbody></table></div><p class="suave">${filasResultados.length} jugadores · origen: ${esc(origenResultados)}</p>`
    : `<p class="suave">Aquí aparece la tabla de posiciones antes de publicarla.</p>`;
}
async function ndjson(url) {
  const r = await fetch(url, { headers: { Accept: "application/x-ndjson" } });
  if (r.status === 429) throw new Error("Lichess pidió esperar un minuto. Vuelve a intentar luego.");
  if (!r.ok) return null;
  return (await r.text()).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}
$("r-traer").addEventListener("click", async () => {
  const texto = $("r-lichess").value.trim();
  const id = texto.match(/(?:swiss|tournament)\/([A-Za-z0-9]{8})/)?.[1] ?? (texto.match(/^[A-Za-z0-9]{8}$/) ? texto : null);
  if (!id) {
    $("r-estado").textContent = "No reconozco ese enlace. Debe ser como https://lichess.org/swiss/XXXXXXXX o https://lichess.org/tournament/XXXXXXXX.";
    return;
  }
  $("r-estado").textContent = "Consultando Lichess…";
  try {
    // En producción esta consulta la hace el servidor; en la demo, el navegador (una sola petición).
    let tipo = "swiss";
    let res = /tournament\//.test(texto) ? null : await ndjson(`https://lichess.org/api/swiss/${id}/results?nb=300`);
    if (!res) {
      tipo = "arena";
      res = await ndjson(`https://lichess.org/api/tournament/${id}/results?nb=300`);
    }
    if (!res?.length) throw new Error("Lichess no devolvió resultados para ese torneo.");
    filasResultados = res.map((x) => ({ puesto: x.rank, nombre: x.username, puntos: x.points ?? x.score ?? null, categoria: "" }));
    origenResultados = `Lichess (${tipo === "swiss" ? "suizo" : "arena"} ${id})`;
    if (!$("r-nombre").value.trim()) {
      const info = await fetch(tipo === "swiss" ? `https://lichess.org/api/swiss/${id}` : `https://lichess.org/api/tournament/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      $("r-nombre").value = info?.name ?? info?.fullName ?? "";
    }
    $("r-estado").textContent = `Listo: ${filasResultados.length} jugadores.`;
  } catch (err) {
    filasResultados = [];
    $("r-estado").textContent = err.message || "No se pudo consultar Lichess.";
  }
  vistaPrevia();
});
$("r-csv-archivo").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (f) $("r-csv").value = await f.text();
});
$("r-leer").addEventListener("click", () => {
  filasResultados = leerCsvResultados($("r-csv").value);
  origenResultados = "CSV";
  $("r-estado").textContent = filasResultados.length
    ? `Leídas ${filasResultados.length} filas.`
    : "No encontré una columna de nombres. La primera fila debe tener encabezados (Puesto, Nombre, Puntos…).";
  vistaPrevia();
});
$("r-publicar").addEventListener("click", () => {
  const nombre = $("r-nombre").value.trim();
  if (!nombre) {
    $("r-estado").textContent = "Escribe el nombre del torneo antes de publicar.";
    $("r-nombre").focus();
    return;
  }
  const clave = nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
  publicarResultados(clave, { nombre, origen: origenResultados, filas: filasResultados, cronica: $("r-cronica").value.trim() });
  filasResultados = [];
  vistaPrevia();
  $("r-estado").innerHTML = `Publicado. <a href="${base}/torneos/" target="_blank">Verlo en Torneos ↗</a>`;
});
function pintarResultados() {
  const r = resultadosPublicados();
  const claves = Object.keys(r);
  $("r-lista").innerHTML = claves.length
    ? claves
        .map((k) => `<div class="tarjeta fila-simple"><div><strong>${esc(r[k].nombre)}</strong><br><span class="suave">${r[k].filas.length} jugadores · ${esc(r[k].origen)}</span></div><button class="boton boton-secundario boton-chico peligro" type="button" data-borrar-res="${esc(k)}">Quitar</button></div>`)
        .join("")
    : `<p class="suave">Todavía no hay resultados publicados desde el panel.</p>`;
}
$("r-lista").addEventListener("click", (e) => {
  const k = e.target.closest("[data-borrar-res]")?.dataset.borrarRes;
  if (k) borrarResultados(k);
});

// ------------------------------------------------------------------ noticias
$("form-noticia").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const titulo = String(f.get("titulo") || "").trim();
  const cuerpo = String(f.get("cuerpo") || "").trim();
  if (!titulo || !cuerpo) return;
  crearNoticia({ titulo, cuerpo });
  e.target.reset();
});
function pintarNoticias() {
  const lista = noticias();
  $("n-lista").innerHTML = lista.length
    ? lista
        .map((n) => `<div class="tarjeta fila-simple"><div><strong>${esc(n.titulo)}</strong><br><span class="suave">${esc(n.fecha)}</span></div><button class="boton boton-secundario boton-chico peligro" type="button" data-borrar-noticia="${esc(n.id)}">Borrar</button></div>`)
        .join("")
    : `<p class="suave">Aún no hay noticias publicadas desde el panel.</p>`;
}
$("n-lista").addEventListener("click", (e) => {
  const id = e.target.closest("[data-borrar-noticia]")?.dataset.borrarNoticia;
  if (id && confirm("¿Borrar esta noticia?")) borrarNoticia(id);
});

// ------------------------------------------------------------------ datos del club
function pintarDatos() {
  const grupos = {};
  for (const [k, c] of Object.entries(CAMPOS)) (grupos[c.grupo] ??= []).push([k, c]);
  $("datos-campos").innerHTML = Object.entries(grupos)
    .map(
      ([g, campos]) => `<fieldset class="grupo-datos"><legend>${esc(g)}</legend><div class="dos-columnas">${campos
        .map(([k, c]) => {
          const v = contenido(k) ?? "";
          return `<div class="campo"><label for="d-${k}">${esc(c.etiqueta)} ${v ? '<span class="etiqueta etiqueta-ok">publicado</span>' : '<span class="pc">por confirmar</span>'}</label>
            ${c.tipo === "textarea" || k === "entrenadores"
              ? `<textarea id="d-${k}" name="${k}" ${c.propuesta ? `placeholder="${esc(c.propuesta)}"` : ""}>${esc(v)}</textarea>${
                  c.propuesta && !v ? `<button class="boton boton-secundario boton-chico usar-propuesta" type="button" data-usar="${k}">Usar la propuesta</button>` : ""
                }`
              : `<input id="d-${k}" name="${k}" type="${c.tipo === "email" ? "email" : c.tipo === "url" ? "url" : "text"}" value="${esc(v)}" ${c.tipo === "tel" ? 'inputmode="numeric"' : ""} />`}
            ${c.ayuda ? `<span class="ayuda">${esc(c.ayuda)}</span>` : ""}</div>`;
        })
        .join("")}</div></fieldset>`,
    )
    .join("");
}
$("form-datos").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const valores = {};
  for (const k of Object.keys(CAMPOS)) {
    const v = String(f.get(k) ?? "").trim();
    valores[k] = v || null;
  }
  if (valores.whatsapp && !/^(51)?9\d{8}$/.test(valores.whatsapp.replace(/\D/g, ""))) {
    $("datos-aviso").textContent = "El WhatsApp debe ser un celular peruano: 9 dígitos, con o sin el 51 delante.";
    $("d-whatsapp").focus();
    return;
  }
  if (valores.whatsapp) {
    const n = valores.whatsapp.replace(/\D/g, "");
    valores.whatsapp = n.length === 9 ? `51${n}` : n;
  }
  guardarContenido(valores);
  $("datos-aviso").innerHTML = `Guardado. Toda la web ya muestra estos datos. <a href="${base}/academia/" target="_blank">Revisar la Academia ↗</a>`;
});
$("datos-campos").addEventListener("click", (e) => {
  const k = e.target.closest("[data-usar]")?.dataset.usar;
  if (!k) return;
  const campo = $(`d-${k}`);
  campo.value = CAMPOS[k].propuesta;
  campo.focus();
  e.target.remove();
});
// Para que lo cargado en el panel quede en la web oficial: se descarga contenido.json con los
// valores y se reemplaza src/data/contenido.json en el repositorio (ver README).
$("datos-descargar").addEventListener("click", () => {
  const salida = structuredClone(contenidoBaseCompleto);
  for (const k of Object.keys(salida.campos)) salida.campos[k].valor = contenido(k);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(salida, null, 2) + "\n"], { type: "application/json" }));
  a.download = "contenido.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("reiniciar").addEventListener("click", async () => {
  if (!confirm("¿Reiniciar la demo? Se borra todo lo creado en este navegador.")) return;
  for (const v of urlsVoucher.values()) v && URL.revokeObjectURL(v.url);
  urlsVoucher.clear();
  await reiniciarDemo();
  await sembrarDemo({ forzar: true });
  pintarTodo();
});

// ------------------------------------------------------------------ todo
function pintarTodo() {
  pintarResumen();
  pintarInscripciones();
  pintarTorneos();
  pintarResultados();
  pintarNoticias();
  // No repintar el formulario de datos mientras se escribe en él.
  if (!$("form-datos").contains(document.activeElement)) pintarDatos();
}
alCambiar(() => {
  if (!$("panel").hidden) pintarTodo();
});

// Al recargar con la sesión abierta se entra directo. Va al final: todo lo de arriba ya está definido.
let dentro = false;
try {
  dentro = sessionStorage.getItem(SESION) === "1";
} catch {}
if (dentro) entrar();

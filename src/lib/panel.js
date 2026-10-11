// Panel del organizador. Todo pasa por store.js: en la demo, el navegador; en la web oficial,
// Supabase con acceso por correo y contraseña y reglas de acceso por fila (RLS).
import {
  CAMPOS, contenido, guardarContenido, pendientesDeConfirmar, todosLosTorneos, torneosCreados, crearTorneo, borrarTorneo,
  inscripciones, cambiarEstadoPago, suprimirInscripcion, leerVoucher, csvInscritos, noticias, crearNoticia, borrarNoticia,
  resultadosPublicados, publicarResultados, borrarResultados, leerCsvResultados, sembrarDemo, reiniciarDemo, alCambiar,
  TORNEO_VERANO, hayNube, listo, sesionPanel, entrarPanel, salirPanel, cargarPanel, ROLES, listaPersonal, darAcceso, quitarAcceso,
  reclamarAdmin, cambiarClave, cargarVisitas, confirmarLugar, alumnosAcademia, pagosMensuales, crearAlumno, darDeBaja, reactivarAlumno,
  borrarAlumno, registrarPago, anularPago, csvAlumnos, sembrarAcademiaDemo, MOTIVOS_BAJA, MEDIOS_PAGO,
} from "./store.js";
import { calcularMetricas, csvMetricas, PERIODOS, calcularAcademia, juntarAcciones, mesDe } from "./metricas.js";
import { numeroWhatsapp } from "./contacto.js";
import { esc } from "./html.js";
import contenidoBaseCompleto from "../data/contenido.json";

const $ = (id) => document.getElementById(id);
const base = document.body.dataset.base ?? "";

// Una acción que va a la base de datos puede fallar (sin internet, sesión vencida): se avisa, no se calla.
async function conAviso(accion) {
  try {
    return await accion();
  } catch (err) {
    alert(err?.message || "No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.");
    throw err;
  }
}

// ------------------------------------------------------------------ entrada y rol
let perfilActual = null;
async function entrar(perfil) {
  if (perfil.reclamar) return pedirActivacion(perfil);
  perfilActual = perfil;
  $("puerta").hidden = true;
  $("panel").hidden = false;
  aplicarRol(perfil);
  pintarTodo();
  if (hayNube) {
    await listo();
    // Los contactos y pagos solo los carga el admin (la base de datos igual se los niega al resto).
    if (perfil.rol === "admin") await conAviso(cargarPanel).catch(() => {});
  } else {
    await sembrarDemo();
    sembrarAcademiaDemo();
  }
  pintarTodo();
}
$("acceso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const aviso = $("acceso-aviso");
  aviso.textContent = "Entrando…";
  try {
    const perfil = await entrarPanel(String(f.get("correo") ?? "").trim(), String(f.get("clave") ?? ""));
    aviso.textContent = "";
    e.target.reset();
    entrar(perfil);
  } catch (err) {
    aviso.textContent = err.message;
  }
});
// Primer ingreso del dueño: su cuenta no tiene rol y el club aún no tiene administrador.
function pedirActivacion(perfil) {
  $("acceso").hidden = true;
  $("reclamar").hidden = false;
  $("reclamar-correo").textContent = perfil.correo;
  $("reclamar-nombre").focus();
}
$("reclamar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const aviso = $("reclamar-aviso");
  aviso.textContent = "Activando…";
  try {
    const perfil = await reclamarAdmin($("reclamar-nombre").value);
    aviso.textContent = "";
    $("reclamar").hidden = true;
    $("acceso").hidden = false;
    entrar(perfil);
  } catch (err) {
    aviso.textContent = err.message;
  }
});
$("reclamar-salir").addEventListener("click", async () => {
  await salirPanel();
  location.reload();
});

// Cambiar la contraseña propia (cualquier rol).
$("abrir-clave").addEventListener("click", () => {
  $("form-clave").reset();
  $("clave-aviso").textContent = "";
  $("dlg-clave").showModal();
});
$("clave-cerrar").addEventListener("click", () => $("dlg-clave").close());
$("form-clave").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await cambiarClave(String(f.get("nueva") ?? ""), String(f.get("repetida") ?? ""));
    e.target.reset();
    $("clave-aviso").textContent = "Listo: la próxima vez entra con la contraseña nueva.";
  } catch (err) {
    $("clave-aviso").textContent = err.message;
  }
});

// Demo: «Usar esta cuenta» llena el formulario con una cuenta de prueba.
document.querySelectorAll("[data-cuenta]").forEach((b) =>
  b.addEventListener("click", () => {
    $("acceso-correo").value = b.dataset.cuenta;
    $("acceso-clave").value = b.dataset.clave;
    $("acceso").requestSubmit();
  }),
);
$("salir").addEventListener("click", async () => {
  await salirPanel();
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
const visibles = () => pestanas.filter((t) => !t.hidden);
pestanas.forEach((t) => {
  t.addEventListener("click", () => abrir(t));
  t.addEventListener("keydown", (e) => {
    const v = visibles();
    const i = v.indexOf(t);
    if (e.key === "ArrowRight") abrir(v[(i + 1) % v.length], true);
    if (e.key === "ArrowLeft") abrir(v[(i - 1 + v.length) % v.length], true);
  });
});
// Cada rol ve solo sus pestañas (data-roles en panel.astro).
function aplicarRol(perfil) {
  $("saludo").textContent = `Hola, ${perfil.nombre}`;
  $("rol-etiqueta").textContent = ROLES[perfil.rol] ?? perfil.rol;
  $("rol-texto").textContent = perfil.rol === "admin" ? "Acceso completo" : "Torneos, resultados y noticias";
  for (const t of pestanas) t.hidden = !t.dataset.roles.split(" ").includes(perfil.rol);
  const v = visibles();
  abrir(v.find((t) => t.id === `t-${location.hash.slice(1)}`) ?? v[0]);
}

// ------------------------------------------------------------------ resumen
const CINCO = ["horario_basico", "precio_mensual", "sede", "whatsapp"];
function pintarResumen() {
  const todas = inscripciones();
  const pend = todas.filter((i) => i.estado_pago === "pendiente" && !i.en_espera).length;
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
  pintarAcciones($("resumen-acciones"), juntarAcciones(metricasActuales(30).acciones, academiaActual(mesDe()).acciones));

  $("checklist").innerHTML = items
    .map(([t, ok]) => `<li class="${ok ? "hecho" : ""}"><span aria-hidden="true">${ok ? "✓" : "○"}</span> ${esc(t)}${ok ? '<span class="visually-hidden"> (listo)</span>' : ""}</li>`)
    .join("");
}

// ------------------------------------------------------------------ métricas (solo admin)
// Los cálculos están en metricas.js (probados en tests/metricas.test.mjs); aquí solo se dibujan.
const soles = (n) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)} %`);
const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
let visitas = { desde: null, filas: [], hora: 0 };

// El torneo de verano toma costo, cupo y fecha de «Datos del club» (si el club los confirmó).
function torneosParaMetricas() {
  return todosLosTorneos().map((t) =>
    t.id === TORNEO_VERANO.id
      ? { ...t, costo: contenido("verano_costo") ?? "", cupo: contenido("verano_cupo") ?? "", fecha: /^\d{4}-\d{2}-\d{2}$/.test(contenido("verano_fecha") ?? "") ? contenido("verano_fecha") : "" }
      : t,
  );
}
const academiaActual = (mes) => calcularAcademia({ alumnos: alumnosAcademia(), pagos: pagosMensuales(), mes });
function metricasActuales(dias) {
  return calcularMetricas({ inscripciones: inscripciones(), torneos: torneosParaMetricas(), web: visitas.filas, dias });
}
// Las visitas se piden a la base de datos como mucho una vez por minuto.
async function traerVisitas() {
  if (Date.now() - visitas.hora < 60_000) return;
  visitas.hora = Date.now();
  try {
    visitas.filas = await cargarVisitas();
  } catch {
    visitas.filas = [];
  }
}

const NIVEL_ACCION = { urgente: ["Urgente", "etiqueta-error"], atencion: ["Atención", "etiqueta-ejemplo"], idea: ["Idea", "etiqueta-ok"] };
function pintarAcciones(ul, lista) {
  ul.innerHTML = lista.length
    ? lista
        .map((a) => {
          const [t, cls] = NIVEL_ACCION[a.nivel];
          const ir = a.ir ? ` <a href="#${a.ir}" data-ir="${a.ir}">Ir a ${{ inscripciones: "Inscripciones", academia: "Academia", torneos: "Torneos" }[a.ir]} →</a>` : "";
          return `<li><span class="etiqueta ${cls}">${t}</span><span>${esc(a.texto)}${ir}</span></li>`;
        })
        .join("")
    : `<li><span class="etiqueta etiqueta-ok">Al día</span><span>Nada pendiente: no hay pagos por validar, mensualidades atrasadas ni torneos que necesiten atención.</span></li>`;
}

function barras(lista, total) {
  if (!lista.length) return `<p class="suave">Sin inscripciones en este periodo.</p>`;
  const max = Math.max(...lista.map(([, n]) => n));
  return `<ul class="barras">${lista
    .map(
      ([nombre, n]) => `<li><span class="nombre" title="${esc(nombre)}">${esc(nombre)}</span>
        <span class="pista" aria-hidden="true"><span class="relleno" style="width:${(n / max) * 100}%"></span></span>
        <span class="valor">${n}<span class="visually-hidden"> de ${total}</span></span></li>`,
    )
    .join("")}</ul>`;
}

function cifra(valor, etiqueta, detalle = "") {
  return `<div class="cifra"><strong>${valor}</strong><span>${etiqueta}</span>${detalle ? `<small>${detalle}</small>` : ""}</div>`;
}
function variacion(actual, anterior, formato = (n) => n) {
  if (!anterior && !actual) return "Igual que en el periodo anterior.";
  if (!anterior) return `El periodo anterior: ${formato(0)}.`;
  const v = (actual - anterior) / anterior;
  const clase = v > 0 ? "sube" : v < 0 ? "baja" : "";
  return `<b class="${clase}">${v > 0 ? "▲" : v < 0 ? "▼" : "="} ${Math.abs(Math.round(v * 100))} %</b> frente al periodo anterior (${formato(anterior)}).`;
}

async function pintarMetricas() {
  if (perfilActual?.rol !== "admin") return;
  await traerVisitas();
  const dias = Number($("m-periodo").value);
  const m = metricasActuales(dias);
  const conPeriodo = dias !== 0;

  const ingresosDetalle = [
    conPeriodo ? variacion(m.ingresos.total, m.ingresos.anterior, soles) : `${m.ingresos.validadas} pagos validados.`,
    m.ingresos.sinPrecio ? `${m.ingresos.sinPrecio} sin costo cargado no suman.` : "",
  ].join(" ");
  $("m-kpis").innerHTML = [
    cifra(soles(m.ingresos.total), "cobrado y validado", ingresosDetalle),
    cifra(soles(m.porCobrar.total), "por cobrar hoy", `${m.porCobrar.pagos} ${m.porCobrar.pagos === 1 ? "pago espera" : "pagos esperan"} validación.${m.porCobrar.sinPrecio ? ` ${m.porCobrar.sinPrecio} sin costo cargado.` : ""}`),
    cifra(m.inscripciones.total, "inscripciones", conPeriodo ? variacion(m.inscripciones.total, m.inscripciones.anterior) : "Desde la primera inscripción."),
    cifra(pct(m.jugadores.retencion), "jugadores que vuelven", m.jugadores.unicos ? `${m.jugadores.vuelven} de ${m.jugadores.unicos} jugadores jugaron 2 torneos o más. ${m.jugadores.nuevos} nuevos en el periodo.` : "Aún no hay jugadores."),
    cifra(m.pagos.medianaHoras == null ? "—" : m.pagos.medianaHoras < 1 ? "< 1 h" : `${Math.round(m.pagos.medianaHoras)} h`, "para validar un pago", `Lo normal (mediana). ${m.pagos.atrasados ? `<b class="baja">${m.pagos.atrasados} esperan más de 2 días.</b>` : "Ninguno espera más de 2 días."}`),
    cifra(
      pct(m.web.conversion),
      "de las visitas se inscribe",
      m.web.conversion != null
        ? `${m.web.inscripciones} inscripciones de ${m.web.sesiones} visitas a la web.`
        : m.web.sesiones
          ? `Aún hay pocas visitas contadas (${m.web.sesiones}) para calcularlo bien.`
          : "Aún no hay visitas registradas.",
    ),
  ].join("");

  const ac = academiaActual(mesDe());
  pintarAcciones($("m-acciones"), juntarAcciones(m.acciones, ac.acciones));
  $("m-academia-mes").textContent = ac.mesTexto;
  $("m-academia").innerHTML = [
    cifra(ac.activos, "alumnos activos", `${ac.altas} ${ac.altas === 1 ? "entró" : "entraron"} y ${ac.bajas} ${ac.bajas === 1 ? "se fue" : "se fueron"} este mes.`),
    cifra(ac.pagaron, ac.pagaron === 1 ? "pagó el mes" : "pagaron el mes", ac.pagosSinMonto ? `${soles(ac.cobrado)} cobrados · ${ac.pagosSinMonto} sin monto registrado.` : `${soles(ac.cobrado)} cobrados.`),
    cifra(soles(ac.porCobrar), "faltan por cobrar", `${ac.faltan} ${ac.faltan === 1 ? "alumno" : "alumnos"}.${ac.sinMensualidad ? ` ${ac.sinMensualidad} sin mensualidad cargada.` : ""}`),
    cifra(pct(ac.retencion3m), "siguen a los 3 meses", ac.base3m ? `De los ${ac.base3m} que estudiaban hace 3 meses.` : "Aún no hay alumnos con 3 meses."),
  ].join("");

  const maxSemana = Math.max(1, ...m.semanas.map((s) => s.total));
  $("m-semanas").innerHTML = `<ol class="semanas" aria-label="Inscripciones por semana">${m.semanas
    .map(
      (s, k) => `<li class="semana${k === 11 ? " actual" : ""}"><b>${s.total || ""}</b>
        <span class="col" style="height:${(s.total / maxSemana) * 120}px" aria-hidden="true"></span>
        <span>${dia(s.desde)}</span><span class="visually-hidden">: ${s.total} inscripciones</span></li>`,
    )
    .join("")}</ol>`;

  const filasT = m.torneos.filter((t) => !t.ejemplo || t.inscritos);
  $("m-torneos").innerHTML = filasT.length
    ? `<div class="tabla-envoltura" tabindex="0" role="region" aria-label="Tabla de torneos"><table>
        <thead><tr><th>Torneo</th><th>Fecha</th><th>Cupo</th><th class="num">Validados</th><th class="num">Cobrado</th><th class="num">Por cobrar</th></tr></thead>
        <tbody>${filasT
          .map((t) => {
            const ocup = t.cupo
              ? `<div class="ocupacion"><span>${t.inscritos} de ${t.cupo} · ${pct(t.ocupacion)}</span><span class="pista" aria-hidden="true"><span class="relleno${t.ocupacion >= 0.9 ? " lleno" : ""}" style="width:${Math.min(100, t.ocupacion * 100)}%"></span></span></div>`
              : `${t.inscritos} inscritos <span class="suave">(sin cupo)</span>`;
            return `<tr><td><strong>${esc(t.nombre)}</strong>${t.ejemplo ? ' <span class="etiqueta etiqueta-ejemplo">ejemplo</span>' : ""}</td><td>${t.fecha ? dia(t.fecha) : "—"}</td><td>${ocup}</td>
              <td class="num">${t.validados}</td><td class="num">${t.precio == null ? '<span class="suave">sin costo</span>' : soles(t.cobrado)}</td><td class="num">${t.precio == null ? "—" : soles(t.porCobrar)}</td></tr>`;
          })
          .join("")}</tbody></table></div>`
    : `<p class="suave">Aún no hay torneos con inscripciones.</p>`;

  const total = m.inscripciones.total;
  $("m-categorias").innerHTML = barras(m.categorias, total);
  $("m-niveles").innerHTML = barras(m.niveles, total);
  $("m-origen").innerHTML =
    barras(
      [["Ajedrez Club Mokewa", m.origen.mokewa], ["Otros clubes o colegios", m.origen.otros], ["Sin club", m.origen.sinClub]].filter(([, n]) => n),
      total,
    ) + (m.origen.clubes.length ? `<p class="suave" style="margin-top:10px">Los que más traen: ${m.origen.clubes.map(([c, n]) => `${esc(c)} (${n})`).join(", ")}.</p>` : "");

  const w = m.web;
  const pasos = [
    ["Visitas a la web", w.sesiones],
    ["Clics para escribir al club", w.contactos],
    ["Empezaron una inscripción", w.inicios],
    ["Terminaron la inscripción", w.inscripciones],
  ];
  $("m-embudo").innerHTML = w.hayDatos
    ? `<h3 class="h-bloque" style="font-size:1.05rem">Del interés a la inscripción</h3><ol class="embudo">${pasos
        .map(([t, n], k) => `<li style="--n:${k}"><span>${t}</span><strong>${n.toLocaleString("es-PE")}</strong></li>`)
        .join("")}</ol>${w.comoLlegar ? `<p class="suave" style="margin-top:8px">Además, ${w.comoLlegar} ${w.comoLlegar === 1 ? "persona pidió" : "personas pidieron"} cómo llegar a la sede.</p>` : ""}`
    : `<p class="suave">Todavía no hay visitas registradas. Se empiezan a contar cuando la web oficial esté conectada a la base de datos.</p>`;
  $("m-paginas").innerHTML = w.paginas.length
    ? `<h3 class="h-bloque" style="font-size:1.05rem">Páginas más vistas</h3>${barras(w.paginas.map(([p, n]) => [p === "/" ? "Inicio" : p, n]), w.vistas)}`
    : "";
}
$("m-periodo").addEventListener("change", pintarMetricas);
$("m-csv").addEventListener("click", () => {
  const dias = Number($("m-periodo").value);
  const etiqueta = PERIODOS.find(([d]) => d === dias)?.[1] ?? "";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csvMetricas(metricasActuales(dias), etiqueta, academiaActual(mesDe()))], { type: "text/csv;charset=utf-8" }));
  a.download = `metricas-mokewa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
// Enlaces internos «Ir a…» de las recomendaciones: abren la pestaña.
document.addEventListener("click", (e) => {
  const ir = e.target.closest("[data-ir]")?.dataset.ir;
  if (!ir) return;
  e.preventDefault();
  abrir($(`t-${ir}`), true);
});

// ------------------------------------------------------------------ academia (solo admin)
$("a-mes").value = mesDe();
const mesElegido = () => $("a-mes").value || mesDe();
// «12 oct.» este año; «25 nov. 2025» si es de otro año.
const fechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
};

// El recordatorio va redactado; el administrador lo revisa y lo envía desde su WhatsApp.
function recordatorio(a, ac) {
  const tel = numeroWhatsapp(a.tutor_telefono);
  if (!tel) return "";
  const monto = a.mensualidad != null && a.mensualidad !== "" ? ` (${soles(Number(a.mensualidad))})` : "";
  const texto = `Hola${a.tutor_nombre ? `, ${a.tutor_nombre}` : ""}. Le recordamos la mensualidad de ${ac.mesTexto}${monto} de ${a.nombres} en la academia del Ajedrez Club Mokewa. Si ya la pagó, por favor ignore este mensaje. ¡Gracias!`;
  return `<a class="boton boton-secundario boton-chico" href="https://wa.me/${tel}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Recordar por WhatsApp</a>`;
}

function pintarAcademia() {
  if (perfilActual?.rol !== "admin") return;
  const mes = mesElegido();
  const ac = academiaActual(mes);
  $("a-mes-texto").textContent = ac.mesTexto;
  $("globo-academia").textContent = mes === mesDe() && ac.acciones.some((x) => x.ir === "academia" && x.nivel !== "idea") ? ac.faltan : "";
  $("a-cifras").innerHTML = [
    cifra(ac.activos, "alumnos activos", `${ac.altas} ${ac.altas === 1 ? "alta" : "altas"} y ${ac.bajas} ${ac.bajas === 1 ? "baja" : "bajas"} en el mes.`),
    cifra(ac.pagaron, ac.pagaron === 1 ? "pagó el mes" : "pagaron el mes", `${soles(ac.cobrado)} cobrados.${ac.pagosSinMonto ? ` ${ac.pagosSinMonto} sin monto.` : ""}`),
    cifra(soles(ac.porCobrar), "por cobrar", `${ac.faltan} ${ac.faltan === 1 ? "alumno falta" : "alumnos faltan"}.${ac.sinMensualidad ? ` ${ac.sinMensualidad} sin mensualidad cargada.` : ""}`),
    cifra(pct(ac.retencion3m), "siguen a los 3 meses", ac.motivos.length ? `Motivo de baja más común: ${esc(ac.motivos[0][0])}.` : "Anota el motivo al dar de baja."),
  ].join("");
  $("a-resumen").textContent = ac.activos ? `Primero los que faltan pagar. ${ac.faltan ? "El botón de WhatsApp abre el recordatorio ya escrito." : "Todos pagaron este mes."}` : "Aún no hay alumnos: agrégalos con el formulario.";
  $("a-lista").innerHTML = ac.lista
    .map((a) => {
      const pago = a.pago;
      const nivel = a.nivel ? ` · ${esc(a.nivel)}` : "";
      const precio = a.mensualidad != null && a.mensualidad !== "" ? ` · ${soles(Number(a.mensualidad))} al mes` : "";
      const estado = pago
        ? `<span class="etiqueta etiqueta-ok">Pagó${pago.monto != null ? ` ${soles(Number(pago.monto))}` : ""}${pago.medio ? ` · ${esc(pago.medio)}` : ""} · ${fechaCorta(pago.pagado_en)}</span>`
        : a.baja
          ? `<span class="etiqueta">Se fue el ${fechaCorta(a.baja)}</span>`
          : `<span class="etiqueta etiqueta-ejemplo">Falta pagar</span>`;
      const acciones = pago
        ? `<button class="boton boton-secundario boton-chico" type="button" data-a="anular">Anular pago</button>`
        : a.baja
          ? ""
          : `<label class="visually-hidden" for="medio-${a.id}">Medio de pago de ${esc(a.nombres)}</label><select id="medio-${a.id}" data-medio>${MEDIOS_PAGO.map((m) => `<option>${m}</option>`).join("")}</select>
             <label class="visually-hidden" for="monto-${a.id}">Monto pagado por ${esc(a.nombres)}</label><input id="monto-${a.id}" data-monto type="number" min="0" step="0.5" placeholder="S/" value="${a.mensualidad ?? ""}" />
             <button class="boton boton-primario boton-chico" type="button" data-a="pagar">Registrar pago</button>${recordatorio(a, ac)}`;
      const baja = a.baja
        ? ""
        : `<label class="visually-hidden" for="motivo-${a.id}">Motivo de la baja de ${esc(a.nombres)}</label><select id="motivo-${a.id}" data-motivo>${MOTIVOS_BAJA.map((m) => `<option>${m}</option>`).join("")}</select>
           <button class="boton boton-secundario boton-chico" type="button" data-a="baja">Dar de baja</button>`;
      return `<article class="tarjeta alumno${!pago && !a.baja ? " sin-pago" : ""}" data-id="${esc(a.id)}">
        <div class="alumno-cabeza"><strong>${esc(a.nombres)} ${esc(a.apellidos)}</strong>${estado}</div>
        <p class="suave">${a.prueba ? '<span class="etiqueta">dato de prueba</span> ' : ""}Desde el ${fechaCorta(a.inicio)}${nivel}${precio}${a.tutor_telefono ? ` · ${esc(a.tutor_telefono)}` : ""}</p>
        <div class="grupo-botones acciones">${acciones}</div>
        <details><summary class="suave">Más opciones</summary><div class="grupo-botones acciones">${baja}
          <button class="boton boton-secundario boton-chico peligro" type="button" data-a="borrar">Borrar datos</button></div></details>
      </article>`;
    })
    .join("") || `<p class="tarjeta suave">No hay alumnos activos en ${esc(ac.mesTexto)}.</p>`;

  const bajas = alumnosAcademia().filter((a) => a.baja).sort((x, y) => y.baja.localeCompare(x.baja));
  $("a-n-bajas").textContent = `(${bajas.length})`;
  $("a-bajas").innerHTML = bajas.length
    ? bajas
        .map((a) => `<div class="fila-simple tarjeta" data-id="${esc(a.id)}"><div><strong>${esc(a.nombres)} ${esc(a.apellidos)}</strong><br><span class="suave">Se fue el ${fechaCorta(a.baja)}${a.motivo_baja ? ` · ${esc(a.motivo_baja)}` : ""}</span></div>
          <div class="grupo-botones"><button class="boton boton-secundario boton-chico" type="button" data-a="reactivar">Volvió</button><button class="boton boton-secundario boton-chico peligro" type="button" data-a="borrar">Borrar datos</button></div></div>`)
        .join("")
    : `<p class="suave">Nadie se ha ido. Cuando des de baja a un alumno, anota el motivo: es la mejor pista para no perder a otros.</p>`;
}
$("a-mes").addEventListener("change", pintarAcademia);
for (const lista of ["a-lista", "a-bajas"])
  $(lista).addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const caja = b.closest("[data-id]");
    const id = caja.dataset.id;
    const a = alumnosAcademia().find((x) => x.id === id);
    const accion = b.dataset.a;
    if (accion === "pagar")
      await conAviso(() => registrarPago({ alumno_id: id, mes: mesElegido(), monto: caja.querySelector("[data-monto]").value, medio: caja.querySelector("[data-medio]").value })).catch(() => {});
    if (accion === "anular" && confirm(`¿Anular el pago de ${a.nombres} de este mes?`)) await conAviso(() => anularPago(id, mesElegido())).catch(() => {});
    if (accion === "baja" && confirm(`¿Dar de baja a ${a.nombres} ${a.apellidos}? Seguirá en «Exalumnos» y podrás reactivarlo.`))
      await conAviso(() => darDeBaja(id, caja.querySelector("[data-motivo]").value)).catch(() => {});
    if (accion === "reactivar") await conAviso(() => reactivarAlumno(id)).catch(() => {});
    if (accion === "borrar" && confirm(`¿Borrar todos los datos de ${a.nombres} ${a.apellidos} y sus pagos? No se puede deshacer (derecho de supresión, Ley 29733).`))
      await conAviso(() => borrarAlumno(id)).catch(() => {});
  });
$("form-alumno").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await crearAlumno({ ...Object.fromEntries(f), consentimiento: f.get("consentimiento") === "on" });
    $("al-aviso").textContent = `Listo: ${String(f.get("nombres")).trim()} ya está en la lista.`;
    e.target.reset();
  } catch (err) {
    $("al-aviso").textContent = err.message;
  }
});
$("a-csv").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csvAlumnos()], { type: "text/csv;charset=utf-8" }));
  a.download = `alumnos-mokewa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

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
  // Un comprobante dañado (no es un archivo) se trata como faltante: la lista se pinta igual.
  const info = blob instanceof Blob ? { url: URL.createObjectURL(blob), tipo: blob.type } : null;
  if (info) urlsVoucher.set(id, info);
  return info;
}

async function pintarInscripciones() {
  pintarSelectTorneos();
  const tid = $("i-torneo").value;
  const estado = $("i-estado").value;
  const lista = inscripciones(tid)
    .filter((i) => !estado || (estado === "espera" ? i.en_espera : i.estado_pago === estado && !i.en_espera))
    .sort((a, b) => (a.estado_pago === "pendiente" ? -1 : 0) - (b.estado_pago === "pendiente" ? -1 : 0) || b.creado_en.localeCompare(a.creado_en));
  const todas = inscripciones(tid);
  const espera = todas.filter((i) => i.en_espera).length;
  $("i-resumen").textContent = `${todas.length - espera} inscritos · ${todas.filter((i) => i.estado_pago === "pendiente" && !i.en_espera).length} por validar · ${todas.filter((i) => i.estado_pago === "validado").length} validados${espera ? ` · ${espera} en lista de espera` : ""}`;
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
        <div class="ins-titulo"><strong>${esc(i.nombres)} ${esc(i.apellidos)}</strong> ${i.en_espera ? '<span class="etiqueta etiqueta-vino">Lista de espera</span>' : `<span class="etiqueta ${cls}">${txt}</span>`}${i.prueba ? ' <span class="etiqueta">dato de prueba</span>' : ""}</div>
        <p>${esc(i.categoria)} · ${esc(i.nivel)} · ${esc(i.club || "sin club")}</p>
        <p class="suave">Tutor: ${esc(i.tutor_nombre)} · ${esc(i.tutor_telefono)} · ${esc(i.tutor_correo)}</p>
        <p class="suave">Recibida: ${hora} · consentimiento ${i.consentimiento ? "✓" : "✗"}${i.motivo ? ` · Motivo: ${esc(i.motivo)}` : ""}</p>
        <div class="grupo-botones acciones">
          ${i.en_espera ? `<button class="boton boton-primario boton-chico" type="button" data-accion="confirmar">Darle un lugar</button>` : ""}
          ${i.estado_pago !== "validado" && !i.en_espera ? `<button class="boton boton-primario boton-chico" type="button" data-accion="validar">Validar pago</button>` : ""}
          ${i.estado_pago !== "rechazado" && !i.en_espera ? `<label class="visually-hidden" for="m-${esc(i.id)}">Motivo del rechazo</label><select id="m-${esc(i.id)}" class="motivo">${MOTIVOS.map((m) => `<option>${esc(m)}</option>`).join("")}</select><button class="boton boton-secundario boton-chico" type="button" data-accion="rechazar">Rechazar</button>` : ""}
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
  if (accion === "confirmar" && confirm("¿Darle un lugar? Pasa a la lista de inscritos aunque el cupo esté lleno. Avísale a la familia para que pague.")) await conAviso(() => confirmarLugar(id)).catch(() => {});
  if (accion === "validar") await conAviso(() => cambiarEstadoPago(id, "validado")).catch(() => {});
  if (accion === "pendiente") await conAviso(() => cambiarEstadoPago(id, "pendiente")).catch(() => {});
  if (accion === "rechazar") await conAviso(() => cambiarEstadoPago(id, "rechazado", tarjeta.querySelector(".motivo").value)).catch(() => {});
  if (accion === "suprimir") {
    if (!confirm("¿Borrar todos los datos de este jugador? Se borran sus inscripciones en todos los torneos, sus tutores y sus comprobantes (derecho de supresión, Ley 29733).")) return;
    await conAviso(() => suprimirInscripcion(id)).catch(() => {});
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
$("form-torneo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const nombre = String(f.get("nombre") ?? "").trim();
  if (!nombre) return;
  const fecha = String(f.get("fecha") || "");
  const t = await conAviso(() => crearTorneo({
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
  })).catch(() => null);
  if (!t) return;
  const seg = Math.round((Date.now() - abiertoTorneo) / 1000);
  e.target.reset();
  $("tr-aviso").innerHTML = `Publicado «${esc(t.nombre)}» en ${seg >= 60 ? `${Math.floor(seg / 60)} min ${seg % 60} s` : `${seg} s`}. <a href="${base}/torneos/" target="_blank">Verlo en la web ↗</a>`;
});
function pintarTorneos() {
  const lista = torneosCreados();
  const filas = [TORNEO_VERANO, ...lista].map((t) => {
    const n = inscripciones(t.id).length;
    return `<div class="tarjeta fila-simple"><div><strong>${esc(t.nombre)}</strong>${t.ejemplo ? ' <span class="etiqueta etiqueta-ejemplo">ejemplo</span>' : ""}<br><span class="suave">${esc(t.modalidad)}${t.fecha ? " · " + esc(t.fecha) : ""} · ${n} ${n === 1 ? "inscrito" : "inscritos"}</span></div>
      <div class="grupo-botones"><a class="boton boton-secundario boton-chico" href="${base}/torneos/${t.ejemplo ? "verano-2027/" : `torneo/?t=${encodeURIComponent(t.id)}`}" target="_blank">Ver ↗</a>
      ${t.ejemplo ? "" : `<button class="boton boton-secundario boton-chico peligro" type="button" data-borrar-torneo="${esc(t.id)}">Borrar</button>`}</div></div>`;
  });
  $("tr-lista").innerHTML = filas.join("");
}
$("tr-lista").addEventListener("click", (e) => {
  const id = e.target.closest("[data-borrar-torneo]")?.dataset.borrarTorneo;
  if (id && confirm("¿Borrar este torneo y sus inscripciones?")) conAviso(() => borrarTorneo(id)).catch(() => {});
});

// ------------------------------------------------------------------ resultados
let filasResultados = [];
let origenResultados = "";
function vistaPrevia() {
  $("r-publicar").disabled = !filasResultados.length;
  $("r-vista").innerHTML = filasResultados.length
    ? `<div class="tabla-envoltura" tabindex="0" role="region" aria-label="Vista previa de resultados"><table><thead><tr><th class="num">Puesto</th><th>Jugador</th><th>Cat.</th><th class="num">Puntos</th></tr></thead><tbody>${filasResultados
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
$("r-publicar").addEventListener("click", async () => {
  const nombre = $("r-nombre").value.trim();
  if (!nombre) {
    $("r-estado").textContent = "Escribe el nombre del torneo antes de publicar.";
    $("r-nombre").focus();
    return;
  }
  const clave = nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
  const ok = await conAviso(() => publicarResultados(clave, { nombre, origen: origenResultados, filas: filasResultados, cronica: $("r-cronica").value.trim() })).then(() => true, () => false);
  if (!ok) return;
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
  if (k) conAviso(() => borrarResultados(k)).catch(() => {});
});

// ------------------------------------------------------------------ noticias
$("form-noticia").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const titulo = String(f.get("titulo") || "").trim();
  const cuerpo = String(f.get("cuerpo") || "").trim();
  if (!titulo || !cuerpo) return;
  const ok = await conAviso(() => crearNoticia({ titulo, cuerpo })).then(() => true, () => false);
  if (!ok) return;
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
  if (id && confirm("¿Borrar esta noticia?")) conAviso(() => borrarNoticia(id)).catch(() => {});
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
$("form-datos").addEventListener("submit", async (e) => {
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
  $("datos-aviso").textContent = "Guardando…";
  const ok = await conAviso(() => guardarContenido(valores)).then(() => true, () => false);
  if (!ok) return void ($("datos-aviso").textContent = "No se guardó. Revisa tu conexión e intenta de nuevo.");
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
$("reiniciar")?.addEventListener("click", async () => {
  if (!confirm("¿Reiniciar la demo? Se borra todo lo creado en este navegador.")) return;
  for (const v of urlsVoucher.values()) v && URL.revokeObjectURL(v.url);
  urlsVoucher.clear();
  await reiniciarDemo();
  await sembrarDemo({ forzar: true });
  sembrarAcademiaDemo({ forzar: true });
  pintarTodo();
});

// ------------------------------------------------------------------ personal (solo admin)
async function pintarPersonal() {
  let lista = [];
  try {
    lista = await listaPersonal();
  } catch (err) {
    $("personal-aviso").textContent = err.message;
  }
  $("personal-lista").innerHTML = lista.length
    ? `<div class="tabla-envoltura" tabindex="0" role="region" aria-label="Personal con acceso"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th><span class="visually-hidden">Acciones</span></th></tr></thead><tbody>${lista
        .map((c) => {
          const yo = c.correo === perfilActual?.correo;
          return `<tr data-correo="${esc(c.correo)}" data-nombre="${esc(c.nombre)}"><td>${esc(c.nombre)}${yo ? " (tú)" : ""}</td><td>${esc(c.correo)}</td>
            <td><label class="visually-hidden" for="rol-${esc(c.correo)}">Rol de ${esc(c.nombre)}</label><select id="rol-${esc(c.correo)}" data-cambiar-rol ${yo ? "disabled" : ""}>${Object.entries(ROLES)
              .map(([k, v]) => `<option value="${k}" ${k === c.rol ? "selected" : ""}>${v}</option>`)
              .join("")}</select></td>
            <td>${yo ? "" : `<button class="boton boton-secundario boton-chico peligro" type="button" data-quitar>Quitar acceso</button>`}</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : `<p class="suave">Aún no hay personal con acceso.</p>`;
}
$("personal-lista").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-cambiar-rol]");
  if (!sel) return;
  const fila = sel.closest("tr");
  $("personal-aviso").textContent = "";
  try {
    await darAcceso({ correo: fila.dataset.correo, nombre: fila.dataset.nombre, rol: sel.value });
    $("personal-aviso").textContent = `Rol actualizado: ${fila.dataset.nombre} ahora es ${ROLES[sel.value].toLowerCase()}.`;
  } catch (err) {
    $("personal-aviso").textContent = err.message;
  }
  pintarPersonal();
});
$("personal-lista").addEventListener("click", async (e) => {
  if (!e.target.closest("[data-quitar]")) return;
  const fila = e.target.closest("tr");
  if (!confirm(`¿Quitar el acceso al panel a ${fila.dataset.nombre}?`)) return;
  try {
    await quitarAcceso(fila.dataset.correo, perfilActual?.correo);
    $("personal-aviso").textContent = `${fila.dataset.nombre} ya no tiene acceso.`;
  } catch (err) {
    $("personal-aviso").textContent = err.message;
  }
  pintarPersonal();
});
$("form-personal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await darAcceso({ nombre: f.get("nombre"), correo: f.get("correo"), rol: f.get("rol"), clave: f.get("clave") });
    $("personal-aviso").textContent = `Listo: ${String(f.get("nombre")).trim()} ya puede iniciar sesión como ${ROLES[f.get("rol")].toLowerCase()}.`;
    e.target.reset();
  } catch (err) {
    $("personal-aviso").textContent = err.message;
  }
  pintarPersonal();
});

// ------------------------------------------------------------------ todo
function pintarTodo() {
  if (perfilActual?.rol === "admin") pintarPersonal();
  pintarResumen();
  pintarMetricas();
  pintarAcademia();
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
sesionPanel()
  .then((perfil) => perfil && entrar(perfil))
  .catch(() => {});

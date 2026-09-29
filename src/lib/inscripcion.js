// Lógica de la página de inscripción (torneos/verano-2027 y torneos creados en el panel con ?t=).
import {
  TORNEO_VERANO, torneo, categoriaPara, esMenor, inscribir, guardarVoucher, listaPublica, inscripciones,
  alCambiar, sembrarDemo, TIPOS_VOUCHER, MAX_VOUCHER, pintarCampos,
} from "./store.js";
import { esc } from "./html.js";

const $ = (id) => document.getElementById(id);

// ---- ¿Qué torneo? El de ejemplo o uno creado en el panel (?t=)
const idT = new URLSearchParams(location.search).get("t");
const T = (idT && torneo(idT)) || TORNEO_VERANO;
if (T !== TORNEO_VERANO) {
  document.title = `${T.nombre} · Ajedrez Club Mokewa`;
  $("t-miga").textContent = T.nombre;
  $("t-nombre").textContent = T.nombre;
  $("t-etiquetas").innerHTML = `<span class="etiqueta etiqueta-ok">Creado en el panel</span><span class="etiqueta">${esc(T.modalidad)}</span>`;
  $("t-bajada").textContent = T.descripcion || "Torneo publicado por el organizador desde el panel.";
  const dato = (k, v) => `<div class="tarjeta"><span class="dt">${k}</span><span>${esc(v || "—")}</span></div>`;
  $("t-datos").innerHTML = dato("Fecha", T.fecha) + dato("Ritmo de juego", T.ritmo) + dato("Inscripción", T.costo) + dato("Cupo", T.cupo);
  $("t-cats-lista").textContent = (T.categorias || []).join(", ");
  pintarCampos();
}
const anioTorneo = Number(T.anio) || Number(String(T.fecha || "").slice(0, 4)) || new Date().getFullYear() + 1;

// ---- Categoría y minoría de edad, en vivo
const fecha = $("fecha_nacimiento");
fecha.max = new Date().toISOString().slice(0, 10);
function alCambiarFecha() {
  const v = fecha.value;
  const cat = v ? categoriaPara(v, anioTorneo, T.categorias) : null;
  $("categoria").innerHTML = cat ? `Categoría: <strong>${esc(cat)}</strong>` : v ? "Revisa la fecha" : "";
  const menor = v ? esMenor(v) : true;
  $("aviso-menor").hidden = !(v && menor);
  $("campo-tutor").hidden = !!v && !menor;
  $("contacto-titulo").textContent = v && !menor ? "2. Contacto del jugador" : "2. Contacto del padre, madre o tutor";
}
fecha.addEventListener("input", alCambiarFecha);
alCambiarFecha();

const voucher = $("voucher");
voucher.addEventListener("change", () => {
  const f = voucher.files?.[0];
  $("voucher-info").textContent = f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(2)} MB` : "";
});

// ---- Validación y envío
const inicio = Date.now();
const form = $("formulario");

function validar(d, f) {
  const errores = [];
  const req = (id, msg) => !String(d[id] ?? "").trim() && errores.push([id, msg]);
  req("nombres", "Escribe los nombres del jugador.");
  req("apellidos", "Escribe los apellidos del jugador.");
  req("fecha_nacimiento", "Indica la fecha de nacimiento.");
  const cat = d.fecha_nacimiento ? categoriaPara(d.fecha_nacimiento, anioTorneo, T.categorias) : null;
  if (d.fecha_nacimiento && !cat) errores.push(["fecha_nacimiento", "La fecha de nacimiento no corresponde a ninguna categoría del torneo."]);
  req("nivel", "Elige el nivel.");
  const menor = d.fecha_nacimiento ? esMenor(d.fecha_nacimiento) : true;
  if (menor) req("tutor_nombre", "Escribe el nombre del padre, madre o tutor.");
  if (!/^9\d{8}$/.test(String(d.tutor_telefono ?? "").replace(/\s/g, ""))) errores.push(["tutor_telefono", "El celular debe tener 9 dígitos y empezar con 9."]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.tutor_correo ?? ""))) errores.push(["tutor_correo", "Revisa el correo."]);
  if (!f) errores.push(["voucher", "Sube el comprobante de pago."]);
  else if (!TIPOS_VOUCHER.includes(f.type)) errores.push(["voucher", "El comprobante debe ser JPG, PNG o PDF."]);
  else if (f.size > MAX_VOUCHER) errores.push(["voucher", "El comprobante pesa más de 5 MB."]);
  if (!$("consentimiento").checked) errores.push(["consentimiento", "Marca la autorización para continuar."]);
  return { errores, cat, menor };
}

function marcarErrores(errores) {
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  form.querySelectorAll(".error-campo").forEach((el) => el.remove());
  $("errores").hidden = !errores.length;
  if (!errores.length) return;
  for (const [id, msg] of errores) {
    const el = $(id);
    el.setAttribute("aria-invalid", "true");
    const span = document.createElement("span");
    span.className = "error-campo";
    span.textContent = msg;
    (el.closest(".casilla") ?? el).after(span);
  }
  const n = errores.length;
  $("errores").textContent = `${n > 1 ? "Faltan" : "Falta"} ${n} ${n > 1 ? "datos" : "dato"}: revisa lo marcado en rojo.`;
  $(errores[0][0]).focus();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const f = voucher.files?.[0];
  const { errores, cat, menor } = validar(d, f);
  marcarErrores(errores);
  if (errores.length) return;

  const ins = inscribir({
    torneo_id: T.id,
    nombres: d.nombres.trim(),
    apellidos: d.apellidos.trim(),
    fecha_nacimiento: d.fecha_nacimiento,
    categoria: cat,
    nivel: d.nivel,
    club: d.club.trim(),
    lichess: d.lichess.trim(),
    tutor_nombre: menor ? d.tutor_nombre.trim() : `${d.nombres} ${d.apellidos}`.trim(),
    tutor_telefono: d.tutor_telefono.replace(/\s/g, ""),
    tutor_correo: d.tutor_correo.trim(),
    consentimiento: true,
    consentimiento_fecha: new Date().toISOString(),
    voucher_nombre: f.name,
  });
  await guardarVoucher(ins.id, f);
  const seg = Math.round((Date.now() - inicio) / 1000);
  const tiempo = seg >= 60 ? `${Math.floor(seg / 60)} min ${seg % 60} s` : `${seg} s`;
  form.hidden = true;
  const conf = $("confirmacion");
  conf.hidden = false;
  conf.innerHTML = `<div class="tarjeta exito">
    <p class="antetitulo">Inscripción recibida</p>
    <h2>¡Listo, ${esc(ins.nombres)}!</h2>
    <p>Quedó registrada en <strong>${esc(T.nombre)}</strong>, categoría <strong>${esc(cat)}</strong>, nivel ${esc(ins.nivel)}.</p>
    <p>Estado del pago: <span class="etiqueta etiqueta-ejemplo">Pendiente de validación</span></p>
    <p class="ayuda">Código: <code>${ins.id.slice(0, 8).toUpperCase()}</code>. En la versión oficial llega un correo a ${esc(ins.tutor_correo)} con esta confirmación y otro cuando se valide el pago.</p>
    <p class="tiempo">Te tomó ${tiempo} inscribirte.</p>
    <div class="grupo-botones">
      <a class="boton boton-secundario" href="${document.body.dataset.base}/panel/">Ver cómo lo valida el organizador →</a>
      <button class="boton boton-secundario" type="button" id="otra">Inscribir a otra persona</button>
    </div></div>`;
  $("otra").addEventListener("click", () => location.reload());
  conf.scrollIntoView({ block: "start" });
});

// ---- Listas públicas y «mis inscripciones»
const ESTADOS = {
  pendiente: ["Pago en revisión", "etiqueta-ejemplo"],
  validado: ["Pago validado", "etiqueta-ok"],
  rechazado: ["Pago rechazado", "etiqueta-error"],
};
function pintarListas() {
  const lista = listaPublica(T.id);
  $("n-inscritos").textContent = `(${lista.length})`;
  $("lista-inscritos").innerHTML = lista.length
    ? `<div class="tabla-envoltura"><table><thead><tr><th>Jugador</th><th>Cat.</th><th>Club</th></tr></thead><tbody>${lista
        .map((i) => `<tr><td>${esc(i.nombre)}${i.validado ? ' <span class="ok" title="Pago validado" aria-label="Pago validado">✓</span>' : ""}</td><td>${esc(i.categoria)}</td><td>${esc(i.club)}</td></tr>`)
        .join("")}</tbody></table></div>`
    : `<p>Aún no hay inscritos. ¡Sé el primero!</p>`;
  const mias = inscripciones(T.id).filter((i) => !i.prueba);
  $("mis-inscripciones").hidden = !mias.length;
  $("lista-mias").innerHTML = mias
    .map((i) => {
      const [txt, cls] = ESTADOS[i.estado_pago];
      return `<li><strong>${esc(i.nombres)} ${esc(i.apellidos)}</strong> <span class="etiqueta ${cls}">${txt}</span>${i.motivo ? `<br><small>${esc(i.motivo)}</small>` : ""}</li>`;
    })
    .join("");
}
pintarListas();
alCambiar(pintarListas);

// Datos de prueba para que el panel tenga algo que validar en la presentación.
if (T === TORNEO_VERANO) sembrarDemo().then(pintarListas);

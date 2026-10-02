// Métricas del panel para el dueño del club: cuánto entró, cuánto falta cobrar, cuántos vuelven,
// de dónde llegan, si la web trae inscritos y qué conviene hacer hoy.
// Funciones puras (reciben los datos y devuelven números): las prueba tests/metricas.test.mjs y sirven
// igual para la demo (datos del navegador) y para la web oficial (Supabase).

const DIA = 864e5;
export const PERIODOS = [
  [7, "Últimos 7 días"],
  [30, "Últimos 30 días"],
  [90, "Últimos 3 meses"],
  [365, "Últimos 12 meses"],
  [0, "Desde el inicio"],
];
// Umbrales de las recomendaciones (explicados en el panel junto a cada una).
export const UMBRALES = { horasPagoAtrasado: 48, cupoCasiLleno: 0.9, diasTorneoCerca: 14, cupoBajo: 0.5, rechazoAlto: 0.2, retencionBaja: 0.25, visitasMinimas: 20 };

// «S/ 15», «15 soles», «S/. 12.50» → 15, 15, 12.5; «Gratis» → 0; sin número → null (igual que monto_de en SQL).
export function montoDe(costo) {
  if (costo == null || costo === "") return null;
  const t = String(costo);
  if (/gratis|libre|sin costo/i.test(t)) return 0;
  const m = t.match(/\d+(?:[.,]\d{1,2})?/);
  return m ? Number(m[0].replace(",", ".")) : null;
}
export function cupoDe(cupo) {
  const n = parseInt(String(cupo ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// Mismo nombre, apellidos y fecha de nacimiento = mismo jugador (como clave_nombre en SQL).
const normal = (t) => String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
export const claveJugador = (i) => i.jugador_id || `${normal(i.nombres)}|${normal(i.apellidos)}|${i.fecha_nacimiento ?? ""}`;
const esMokewa = (club) => /mokewa/i.test(club ?? "");
// «Independiente», «ninguno» o «-» en el campo club = juega sin club.
const sinClub = (club) => !club || /^(independiente|ninguno|ninguna|sin club|no|-+|—)$/i.test(String(club).trim());
const porcentaje = (a, b) => (b ? a / b : null);
const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const contar = (xs, f) => {
  const c = new Map();
  for (const x of xs) {
    const k = f(x) || "Sin dato";
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c].sort((a, b) => b[1] - a[1]);
};
const isoDia = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
// Lunes de la semana de una fecha (las semanas del gráfico empiezan en lunes).
const lunes = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

/**
 * @param {object} p
 * @param {object[]} p.inscripciones  todas (el filtro de periodo se aplica aquí)
 * @param {object[]} p.torneos        {id, nombre, fecha, cupo, costo}
 * @param {object[]} [p.web]          filas de visitas_diarias {dia, pagina, evento, total}
 * @param {Date}     [p.hoy]
 * @param {number}   [p.dias]         0 = desde el inicio
 */
export function calcularMetricas({ inscripciones = [], torneos = [], web = [], hoy = new Date(), dias = 30 }) {
  const ahora = +hoy;
  const desde = dias ? ahora - dias * DIA : -Infinity;
  const desdeAnterior = dias ? desde - dias * DIA : -Infinity;
  const enRango = (f, a, b) => {
    const t = Date.parse(f);
    return t >= a && t < b;
  };
  const porTorneo = new Map(torneos.map((t) => [t.id, t]));
  const montoIns = (i) => (i.monto != null && i.monto !== "" ? Number(i.monto) : montoDe(porTorneo.get(i.torneo_id)?.costo));

  const delPeriodo = inscripciones.filter((i) => enRango(i.creado_en, desde, ahora + DIA));
  const anteriores = dias ? inscripciones.filter((i) => enRango(i.creado_en, desdeAnterior, desde)) : [];

  // Dinero: lo validado en el periodo (por fecha de validación) y lo que falta cobrar hoy (todo lo pendiente).
  const sumar = (xs) => {
    let total = 0;
    let sinPrecio = 0;
    for (const i of xs) {
      const m = montoIns(i);
      if (m == null) sinPrecio++;
      else total += m;
    }
    return { total, sinPrecio };
  };
  const validadasPeriodo = inscripciones.filter((i) => i.estado_pago === "validado" && enRango(i.validado_en || i.creado_en, desde, ahora + DIA));
  const validadasAnterior = dias ? inscripciones.filter((i) => i.estado_pago === "validado" && enRango(i.validado_en || i.creado_en, desdeAnterior, desde)) : [];
  const pendientes = inscripciones.filter((i) => i.estado_pago === "pendiente");
  const ingresos = sumar(validadasPeriodo);
  const porCobrar = sumar(pendientes);

  // Pagos: cuánto tarda el club en validar y cuántos esperan demasiado.
  const horas = (i) => (Date.parse(i.validado_en) - Date.parse(i.creado_en)) / 36e5;
  const resueltas = delPeriodo.filter((i) => i.estado_pago !== "pendiente" && i.validado_en);
  const atrasados = pendientes.filter((i) => (ahora - Date.parse(i.creado_en)) / 36e5 > UMBRALES.horasPagoAtrasado);
  const rechazadas = delPeriodo.filter((i) => i.estado_pago === "rechazado").length;

  // Jugadores: únicos de siempre, nuevos en el periodo y cuántos jugaron 2 o más torneos (vuelven).
  const torneosDe = new Map();
  const primeraVez = new Map();
  for (const i of inscripciones) {
    if (i.estado_pago === "rechazado") continue;
    const k = claveJugador(i);
    (torneosDe.get(k) ?? torneosDe.set(k, new Set()).get(k)).add(i.torneo_id);
    const t = Date.parse(i.creado_en);
    if (!primeraVez.has(k) || t < primeraVez.get(k)) primeraVez.set(k, t);
  }
  const unicos = torneosDe.size;
  const vuelven = [...torneosDe.values()].filter((s) => s.size >= 2).length;
  const nuevos = [...primeraVez.values()].filter((t) => t >= desde).length;

  // Torneos: ocupación del cupo, cobrado y por cobrar.
  const listaTorneos = torneos
    .map((t) => {
      const ins = inscripciones.filter((i) => i.torneo_id === t.id && i.estado_pago !== "rechazado");
      const cupo = cupoDe(t.cupo);
      const validados = ins.filter((i) => i.estado_pago === "validado");
      return {
        id: t.id,
        nombre: t.nombre,
        fecha: t.fecha || "",
        ejemplo: !!t.ejemplo,
        inscritos: ins.length,
        cupo,
        ocupacion: cupo ? ins.length / cupo : null,
        validados: validados.length,
        precio: montoDe(t.costo),
        cobrado: sumar(validados).total,
        porCobrar: sumar(ins.filter((i) => i.estado_pago === "pendiente")).total,
      };
    })
    .sort((a, b) => (b.fecha || "9999").localeCompare(a.fecha || "9999") || b.inscritos - a.inscritos);

  // Tendencia: inscripciones por semana, las últimas 12.
  const semanas = [];
  const inicio = lunes(ahora);
  for (let k = 11; k >= 0; k--) {
    const a = +inicio - k * 7 * DIA;
    semanas.push({ desde: isoDia(a), total: inscripciones.filter((i) => enRango(i.creado_en, a, a + 7 * DIA)).length });
  }

  // Web: embudo de visitas a inscripciones (conteo anónimo por día).
  const diaDesde = dias ? isoDia(desde) : "0000";
  const webPeriodo = web.filter((f) => f.dia >= diaDesde);
  const sumaEvento = (...ev) => webPeriodo.filter((f) => ev.includes(f.evento)).reduce((s, f) => s + Number(f.total), 0);
  const sesiones = sumaEvento("sesion");
  const paginas = new Map();
  for (const f of webPeriodo) if (f.evento === "vista") paginas.set(f.pagina, (paginas.get(f.pagina) ?? 0) + Number(f.total));
  const webM = {
    hayDatos: web.length > 0,
    sesiones,
    vistas: sumaEvento("vista"),
    contactos: sumaEvento("whatsapp", "correo", "facebook"),
    comoLlegar: sumaEvento("como_llegar"),
    inicios: sumaEvento("inscripcion_inicio"),
    inscripciones: delPeriodo.length,
    // Con pocas visitas contadas (o si hay más inscripciones que visitas, porque el conteo empezó hace poco)
    // el porcentaje engaña: se muestra «—».
    conversion: sesiones >= UMBRALES.visitasMinimas && delPeriodo.length <= sesiones ? delPeriodo.length / sesiones : null,
    paginas: [...paginas].sort((a, b) => b[1] - a[1]).slice(0, 6),
  };

  const deOtros = delPeriodo.filter((i) => !sinClub(i.club) && !esMokewa(i.club));
  const clubes = contar(deOtros, (i) => i.club.trim());
  const m = {
    dias,
    inscripciones: { total: delPeriodo.length, anterior: anteriores.length, variacion: dias ? porcentaje(delPeriodo.length - anteriores.length, anteriores.length) : null },
    ingresos: { ...ingresos, anterior: sumar(validadasAnterior).total, validadas: validadasPeriodo.length },
    porCobrar: { ...porCobrar, pagos: pendientes.length },
    pagos: { pendientes: pendientes.length, atrasados: atrasados.length, medianaHoras: mediana(resueltas.map(horas).filter((h) => h >= 0)), tasaRechazo: porcentaje(rechazadas, delPeriodo.length) },
    jugadores: { unicos, nuevos, vuelven, retencion: porcentaje(vuelven, unicos) },
    categorias: contar(delPeriodo, (i) => i.categoria),
    niveles: contar(delPeriodo, (i) => i.nivel),
    origen: {
      mokewa: delPeriodo.filter((i) => esMokewa(i.club)).length,
      otros: deOtros.length,
      sinClub: delPeriodo.filter((i) => sinClub(i.club)).length,
      clubes: clubes.slice(0, 5),
    },
    torneos: listaTorneos,
    semanas,
    web: webM,
  };
  m.acciones = acciones(m, ahora);
  return m;
}

// Qué hacer hoy, de lo más urgente a lo que es una idea. Cada una dice el porqué con números.
export function acciones(m, ahora = Date.now()) {
  const a = [];
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (m.pagos.atrasados)
    a.push({ nivel: "urgente", texto: `Valida ${plural(m.pagos.atrasados, "pago que espera", "pagos que esperan")} más de 2 días. Una familia sin respuesta duda de volver a inscribirse.`, ir: "inscripciones" });
  else if (m.pagos.pendientes) a.push({ nivel: "atencion", texto: `Hay ${plural(m.pagos.pendientes, "pago", "pagos")} por validar.`, ir: "inscripciones" });

  for (const t of m.torneos) {
    if (t.ejemplo && !t.inscritos) continue;
    const faltan = t.fecha ? Math.ceil((Date.parse(`${t.fecha}T00:00:00`) - ahora) / DIA) : null;
    const pc = t.ocupacion != null ? Math.round(t.ocupacion * 100) : null;
    if (t.ocupacion != null && t.ocupacion >= UMBRALES.cupoCasiLleno && (faltan == null || faltan >= 0))
      a.push({ nivel: "atencion", texto: `«${t.nombre}» está al ${pc} % del cupo (${t.inscritos} de ${t.cupo}). Decide si amplías el cupo o abres lista de espera.` });
    else if (faltan != null && faltan >= 0 && faltan <= UMBRALES.diasTorneoCerca && t.ocupacion != null && t.ocupacion < UMBRALES.cupoBajo)
      a.push({ nivel: "atencion", texto: `«${t.nombre}» empieza en ${plural(faltan, "día", "días")} y va al ${pc} % del cupo. Es buen momento para difundirlo en los grupos del club.` });
    if (t.precio == null && t.inscritos && !t.ejemplo)
      a.push({ nivel: "idea", texto: `«${t.nombre}» no tiene costo cargado: ponlo en el torneo para ver cuánto se cobró.`, ir: "torneos" });
  }
  if (m.pagos.tasaRechazo != null && m.pagos.tasaRechazo >= UMBRALES.rechazoAlto && m.inscripciones.total >= 5)
    a.push({ nivel: "atencion", texto: `Se rechazó el ${Math.round(m.pagos.tasaRechazo * 100)} % de los comprobantes. Revisa que el monto y el número de Yape o Plin se vean claros en el formulario.` });
  if (m.jugadores.unicos >= 10 && m.jugadores.retencion != null && m.jugadores.retencion < UMBRALES.retencionBaja)
    a.push({ nivel: "idea", texto: `Solo ${Math.round(m.jugadores.retencion * 100)} % de los jugadores volvió a un segundo torneo. Invita por WhatsApp a los del último torneo al siguiente.` });
  if (m.web.sesiones >= 50 && m.web.contactos === 0 && m.web.inicios === 0)
    a.push({ nivel: "idea", texto: `La web tuvo ${m.web.sesiones} visitas y nadie escribió ni empezó una inscripción. Revisa que el botón de contacto tenga el número correcto.` });
  return a;
}

// CSV para el informe a la directiva (se abre en Excel).
export function csvMetricas(m, etiquetaPeriodo) {
  const soles = (n) => (n == null ? "" : n.toFixed(2));
  const pct = (x) => (x == null ? "" : `${Math.round(x * 100)} %`);
  const filas = [
    ["Métrica", "Valor", "Periodo"],
    ["Inscripciones", m.inscripciones.total, etiquetaPeriodo],
    ["Inscripciones del periodo anterior", m.dias ? m.inscripciones.anterior : "", etiquetaPeriodo],
    ["Ingresos validados (S/)", soles(m.ingresos.total), etiquetaPeriodo],
    ["Por cobrar hoy (S/)", soles(m.porCobrar.total), "hoy"],
    ["Pagos por validar", m.pagos.pendientes, "hoy"],
    ["Pagos que esperan más de 2 días", m.pagos.atrasados, "hoy"],
    ["Horas para validar un pago (mediana)", m.pagos.medianaHoras == null ? "" : m.pagos.medianaHoras.toFixed(1), etiquetaPeriodo],
    ["Comprobantes rechazados", pct(m.pagos.tasaRechazo), etiquetaPeriodo],
    ["Jugadores distintos", m.jugadores.unicos, "desde el inicio"],
    ["Jugadores nuevos", m.jugadores.nuevos, etiquetaPeriodo],
    ["Jugadores que volvieron a otro torneo", pct(m.jugadores.retencion), "desde el inicio"],
    ["Visitas a la web", m.web.sesiones, etiquetaPeriodo],
    ["Clics para escribir al club", m.web.contactos, etiquetaPeriodo],
    ["Visitas que terminaron en inscripción", pct(m.web.conversion), etiquetaPeriodo],
    [],
    ["Torneo", "Fecha", "Inscritos", "Cupo", "Validados", "Cobrado (S/)", "Por cobrar (S/)"],
    ...m.torneos.map((t) => [t.nombre, t.fecha, t.inscritos, t.cupo ?? "", t.validados, soles(t.cobrado), soles(t.porCobrar)]),
  ];
  return "﻿" + filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

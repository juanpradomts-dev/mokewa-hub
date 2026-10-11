// Métricas del panel (src/lib/metricas.js): los números que ve el dueño deben ser exactos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularMetricas, montoDe, cupoDe, claveJugador, csvMetricas } from "../src/lib/metricas.js";

const HOY = new Date("2026-10-02T12:00:00");
const hace = (dias, horas = 0) => new Date(+HOY - dias * 864e5 - horas * 36e5).toISOString();
const torneos = [
  { id: "a", nombre: "Relámpago", fecha: "2026-10-10", cupo: "10", costo: "S/ 15" },
  { id: "b", nombre: "Clásico", fecha: "2026-08-01", cupo: "", costo: "Gratis" },
];
let n = 0;
const ins = (extra) => ({
  id: String(++n),
  torneo_id: "a",
  nombres: "Ana",
  apellidos: "Pérez",
  fecha_nacimiento: "2014-01-01",
  categoria: "Sub-14",
  nivel: "Básico",
  club: "Ajedrez Club Mokewa",
  estado_pago: "pendiente",
  creado_en: hace(1),
  ...extra,
});
const datos = [
  ins({ estado_pago: "validado", validado_en: hace(1, -5) }), // validada en 5 h
  ins({ nombres: "Luis", estado_pago: "validado", creado_en: hace(5), validado_en: hace(4) }), // 24 h
  ins({ nombres: "Rosa", creado_en: hace(3) }), // pendiente hace 3 días: atrasada
  ins({ nombres: "Pedro", club: "Colegio Simón Bolívar", estado_pago: "rechazado", validado_en: hace(0) }),
  ins({ torneo_id: "b", nombres: "ANA", apellidos: " perez ", estado_pago: "validado", creado_en: hace(70), validado_en: hace(70) }), // Ana vuelve
  ins({ torneo_id: "b", nombres: "Iván", club: "", creado_en: hace(40), estado_pago: "validado", validado_en: hace(40) }),
];

test("montoDe y cupoDe leen lo que escribe el club", () => {
  assert.equal(montoDe("S/ 15"), 15);
  assert.equal(montoDe("S/. 12,50"), 12.5);
  assert.equal(montoDe("Gratis"), 0);
  assert.equal(montoDe("por definir"), null);
  assert.equal(cupoDe("40"), 40);
  assert.equal(cupoDe(""), null);
});

test("claveJugador: mismo jugador aunque cambien tildes, mayúsculas y espacios", () => {
  assert.equal(claveJugador(datos[0]), claveJugador(datos[4]));
  assert.notEqual(claveJugador(datos[0]), claveJugador(datos[1]));
});

test("periodo de 30 días: inscripciones, comparación y dinero", () => {
  const m = calcularMetricas({ inscripciones: datos, torneos, hoy: HOY, dias: 30 });
  assert.equal(m.inscripciones.total, 4);
  assert.equal(m.inscripciones.anterior, 1); // Iván, hace 40 días
  assert.equal(m.inscripciones.variacion, 3);
  assert.equal(m.ingresos.total, 30); // Ana y Luis a S/ 15
  assert.equal(m.porCobrar.total, 15); // Rosa
  assert.equal(m.porCobrar.pagos, 1);
});

test("pagos: mediana de horas para validar, atrasados y rechazo", () => {
  const m = calcularMetricas({ inscripciones: datos, torneos, hoy: HOY, dias: 30 });
  assert.equal(m.pagos.atrasados, 1);
  assert.equal(m.pagos.medianaHoras, 24); // 5 h, 24 h y el rechazo (24 h) → mediana 24
  assert.equal(m.pagos.tasaRechazo, 0.25);
});

test("jugadores: distintos, nuevos y cuántos vuelven (los rechazados no cuentan)", () => {
  const m = calcularMetricas({ inscripciones: datos, torneos, hoy: HOY, dias: 30 });
  assert.equal(m.jugadores.unicos, 4); // Ana, Luis, Rosa, Iván
  assert.equal(m.jugadores.vuelven, 1); // Ana jugó «a» y «b»
  assert.equal(m.jugadores.nuevos, 2); // Luis y Rosa (Ana ya había jugado hace 70 días)
});

test("torneos: ocupación del cupo, cobrado y por cobrar", () => {
  const m = calcularMetricas({ inscripciones: datos, torneos, hoy: HOY, dias: 0 });
  const a = m.torneos.find((t) => t.id === "a");
  assert.equal(a.inscritos, 3);
  assert.equal(a.ocupacion, 0.3);
  assert.equal(a.cobrado, 30);
  assert.equal(a.porCobrar, 15);
  assert.equal(m.torneos.find((t) => t.id === "b").cobrado, 0);
});

test("origen: del club, de otros clubes y sin club", () => {
  const m = calcularMetricas({ inscripciones: datos, torneos, hoy: HOY, dias: 0 });
  assert.deepEqual([m.origen.mokewa, m.origen.otros, m.origen.sinClub], [4, 1, 1]);
  assert.deepEqual(m.origen.clubes, [["Colegio Simón Bolívar", 1]]);
});

test("web: embudo de visitas a inscripciones, solo dentro del periodo", () => {
  const web = [
    { dia: "2026-10-01", pagina: "/", evento: "sesion", total: 40 },
    { dia: "2026-10-01", pagina: "/", evento: "vista", total: 60 },
    { dia: "2026-10-01", pagina: "/academia/", evento: "vista", total: 25 },
    { dia: "2026-10-01", pagina: "/contacto/", evento: "whatsapp", total: 3 },
    { dia: "2026-10-01", pagina: "/contacto/", evento: "correo", total: 1 },
    { dia: "2026-01-01", pagina: "/", evento: "sesion", total: 999 }, // fuera del periodo
  ];
  const m = calcularMetricas({ inscripciones: datos, torneos, web, hoy: HOY, dias: 30 });
  assert.equal(m.web.sesiones, 40);
  assert.equal(m.web.contactos, 4);
  assert.equal(m.web.conversion, 0.1); // 4 inscripciones / 40 visitas
  assert.deepEqual(m.web.paginas[0], ["/", 60]);
});

test("web: con pocas visitas contadas no inventa un porcentaje", () => {
  const web = [{ dia: "2026-10-01", pagina: "/", evento: "sesion", total: 3 }];
  assert.equal(calcularMetricas({ inscripciones: datos, torneos, web, hoy: HOY, dias: 30 }).web.conversion, null);
});

test("origen: «Independiente» cuenta como sin club", () => {
  const m = calcularMetricas({ inscripciones: [ins({ club: "Independiente" }), ins({ nombres: "Mía", club: "-" })], torneos, hoy: HOY, dias: 30 });
  assert.deepEqual([m.origen.otros, m.origen.sinClub], [0, 2]);
});

test("qué hacer hoy: avisa del pago atrasado primero y del torneo sin precio", () => {
  const sinPrecio = [...torneos, { id: "c", nombre: "Simultánea", fecha: "", cupo: "", costo: "" }];
  const m = calcularMetricas({ inscripciones: [...datos, ins({ torneo_id: "c", nombres: "Eva" })], torneos: sinPrecio, hoy: HOY, dias: 30 });
  assert.equal(m.acciones[0].nivel, "urgente");
  assert.match(m.acciones[0].texto, /más de 2 días/);
  assert.ok(m.acciones.some((x) => /Simultánea.*no tiene costo/.test(x.texto)));
});

test("qué hacer hoy: torneo casi lleno y torneo cercano con poco cupo", () => {
  const lleno = Array.from({ length: 9 }, (_, k) => ins({ nombres: `J${k}`, estado_pago: "validado", validado_en: hace(0) }));
  let m = calcularMetricas({ inscripciones: lleno, torneos, hoy: HOY, dias: 30 });
  assert.ok(m.acciones.some((x) => /90 % del cupo.*lista de espera/.test(x.texto)));
  m = calcularMetricas({ inscripciones: lleno.slice(0, 2), torneos, hoy: HOY, dias: 30 });
  assert.ok(m.acciones.some((x) => /empieza en 8 días y va al 20 %/.test(x.texto)));
});

test("sin datos no se rompe ni inventa", () => {
  const m = calcularMetricas({ hoy: HOY });
  assert.equal(m.inscripciones.total, 0);
  assert.equal(m.jugadores.retencion, null);
  assert.equal(m.pagos.medianaHoras, null);
  assert.equal(m.web.conversion, null);
  assert.deepEqual(m.acciones, []);
  assert.match(csvMetricas(m, "Últimos 30 días"), /Inscripciones/);
});

import { calcularAcademia, mesTexto, juntarAcciones } from "../src/lib/metricas.js";

test("lista de espera: no es deuda ni ocupa cupo, y genera un aviso", () => {
  const espera = [
    ...Array.from({ length: 3 }, (_, k) => ins({ nombres: `E${k}`, estado_pago: "validado", validado_en: hace(0) })),
    ins({ nombres: "Wait", en_espera: true }),
  ];
  const chico = [{ ...torneos[0], cupo: "3" }];
  const m = calcularMetricas({ inscripciones: espera, torneos: chico, hoy: HOY, dias: 30 });
  const t = m.torneos[0];
  assert.deepEqual([t.inscritos, t.enEspera, t.ocupacion], [3, 1, 1]);
  assert.equal(m.porCobrar.pagos, 0);
  assert.ok(m.acciones.some((x) => /«Relámpago» está lleno y 1 persona espera un lugar/.test(x.texto)));
  assert.ok(!m.acciones.some((x) => /% del cupo/.test(x.texto)), "un solo aviso por torneo lleno");
});

const alumnos = [
  { id: "a1", nombres: "Ana", apellidos: "Ríos", nivel: "Básico", mensualidad: 80, inicio: "2026-03-01" },
  { id: "a2", nombres: "Bruno", apellidos: "Paz", nivel: "Intermedio", mensualidad: 100, inicio: "2026-06-15" },
  { id: "a3", nombres: "Ciro", apellidos: "Luna", nivel: "Básico", mensualidad: null, inicio: "2026-10-03" }, // alta de octubre, sin precio
  { id: "a4", nombres: "Dora", apellidos: "Sol", nivel: "Avanzado", mensualidad: 80, inicio: "2026-01-10", baja: "2026-10-01", motivo_baja: "Horario" },
  { id: "a5", nombres: "Eli", apellidos: "Mar", nivel: "Básico", mensualidad: 80, inicio: "2026-02-01", baja: "2026-08-20", motivo_baja: "Horario" },
];
const pagos = [
  { alumno_id: "a1", mes: "2026-10-01", monto: 80, medio: "Yape" },
  { alumno_id: "a4", mes: "2026-10-01", monto: null, medio: "Efectivo" },
  { alumno_id: "a1", mes: "2026-09-01", monto: 80, medio: "Yape" }, // otro mes: no cuenta
];

test("academia: quién pagó el mes, cuánto falta, altas, bajas y motivos", () => {
  const ac = calcularAcademia({ alumnos, pagos, mes: "2026-10", hoy: HOY });
  assert.equal(ac.mesTexto, "octubre de 2026");
  assert.equal(ac.activos, 3); // Eli se fue en agosto y Dora el 1 de octubre
  assert.equal(ac.lista.length, 4, "Dora sigue en la lista del mes: pagó octubre");
  assert.equal(ac.pagaron, 2);
  assert.equal(ac.cobrado, 80);
  assert.equal(ac.pagosSinMonto, 1);
  assert.equal(ac.faltan, 2); // Bruno y Ciro (Dora ya se fue)
  assert.equal(ac.porCobrar, 100);
  assert.equal(ac.sinMensualidad, 1);
  assert.deepEqual([ac.altas, ac.bajas], [1, 1]);
  assert.deepEqual(ac.motivos[0], ["Horario", 2]);
  assert.equal(ac.lista[0].pago, null, "primero los que no pagaron");
});

test("academia: retención a 3 meses y recordatorio solo desde el día 10", () => {
  const ac = calcularAcademia({ alumnos, pagos, mes: "2026-10", hoy: HOY }); // hoy: 2 de octubre
  assert.equal(ac.base3m, 4); // Ana, Bruno, Dora y Eli estaban a inicios de julio
  assert.equal(ac.retencion3m, 0.5); // siguen Ana y Bruno
  assert.ok(!ac.acciones.some((x) => /no pagaron/.test(x.texto)), "el 2 del mes aún no se recuerda");
  const tarde = calcularAcademia({ alumnos, pagos, mes: "2026-10", hoy: new Date("2026-10-12T12:00:00") });
  assert.ok(tarde.acciones.some((x) => /2 alumnos no pagaron octubre de 2026/.test(x.texto)));
  assert.ok(tarde.acciones.some((x) => /motivo más común hasta hoy: «Horario»/.test(x.texto)));
  assert.equal(mesTexto("2027-01"), "enero de 2027");
  assert.equal(juntarAcciones([{ nivel: "idea" }], [{ nivel: "urgente" }])[0].nivel, "urgente");
});

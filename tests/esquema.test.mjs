// Las migraciones de supabase/migrations/ en un Postgres real (PGlite, en memoria) con RLS activo:
// primer administrador, jugadores sin duplicados, monto, conteo de visitas y privacidad.
// Corre con «npm test», sin Docker. La prueba contra Supabase de verdad sigue en tests/nube.integracion.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
await db.exec(leer("./supabase-falso.sql"));
for (const m of readdirSync(new URL("../supabase/migrations/", import.meta.url)).sort()) await db.exec(leer(`../supabase/migrations/${m}`));

// Ejecuta como el público (uid null) o como un usuario con sesión, igual que PostgREST.
async function como(uid, sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec(uid ? `set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);` : "set local role anon;");
    const r = await db.query(sql, params);
    await db.exec("commit");
    return r.rows;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
const falla = async (fn, codigo) => assert.rejects(fn, (e) => (assert.match(String(e.message), new RegExp(codigo)), true));

const DUENO = "00000000-0000-4000-8000-000000000001";
const ENTRENADOR = "00000000-0000-4000-8000-000000000002";
const INTRUSO = "00000000-0000-4000-8000-000000000003";
for (const [id, email] of [[DUENO, "dueno@club.pe"], [ENTRENADOR, "coach@club.pe"], [INTRUSO, "intruso@x.pe"]])
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);

const ficha = (extra = {}) => ({
  torneo_id: "verano-2027",
  nombres: "Lucía",
  apellidos: "Quispe Mamani",
  fecha_nacimiento: "2013-04-02",
  nivel: "Intermedio",
  club: "Ajedrez Club Mokewa",
  tutor_nombre: "María Mamani",
  tutor_telefono: "900000001",
  tutor_correo: "maria@ejemplo.pe",
  consentimiento: true,
  ...extra,
});
const inscribir = async (extra) => (await como(null, "select inscribir($1) as r", [ficha(extra)]))[0].r;

test("primer administrador: sin sesión no se puede", async () => {
  await falla(() => como(null, "select reclamar_admin('Alguien')"), "permission denied");
});

test("primer administrador: una cuenta posterior a la del dueño no puede quedarse con el panel", async () => {
  await falla(() => como(INTRUSO, "select reclamar_admin('Intruso')"), "no_es_primera_cuenta");
  assert.equal((await como(INTRUSO, "select hay_admin() as h"))[0].h, false);
});

test("primer administrador: el dueño (cuenta más antigua) se activa con su nombre", async () => {
  await falla(() => como(DUENO, "select reclamar_admin('   ')"), "datos_incompletos");
  await como(DUENO, "select reclamar_admin('Dueño del club')");
  const [p] = await como(DUENO, "select nombre, rol from perfiles where id = $1", [DUENO]);
  assert.deepEqual(p, { nombre: "Dueño del club", rol: "admin" });
  assert.equal((await como(DUENO, "select hay_admin() as h"))[0].h, true);
});

test("primer administrador: solo una vez, ni siquiera el dueño lo repite", async () => {
  await falla(() => como(DUENO, "select reclamar_admin('Otra vez')"), "ya_hay_admin");
  await falla(() => como(INTRUSO, "select reclamar_admin('Intruso')"), "ya_hay_admin");
});

test("el admin da acceso al entrenador desde el panel", async () => {
  await como(DUENO, "select dar_acceso('coach@club.pe', 'Profe Ana', 'entrenador')");
  await falla(() => como(ENTRENADOR, "select dar_acceso('intruso@x.pe', 'X', 'admin')"), "solo_admin");
});

test("monto_de entiende cómo escribe el club el costo", async () => {
  const casos = [["S/ 15", 15], ["S/. 12.50", 12.5], ["15 soles", 15], ["S/ 7,5", 7.5], ["Gratis", 0], ["por definir", null], [null, null]];
  for (const [texto, esperado] of casos) {
    const [{ m }] = (await db.query("select monto_de($1)::float as m", [texto])).rows;
    assert.equal(m, esperado, String(texto));
  }
});

let primera;
test("inscribir: guarda el monto del torneo (el de verano lo toma de «Datos del club»)", async () => {
  await db.query("insert into contenido (campo, valor) values ('verano_costo', 'S/ 20')");
  primera = await inscribir();
  assert.equal(primera.categoria, "Sub-14");
  const [r] = (await db.query("select monto::float as monto from inscripciones where id = $1", [primera.id])).rows;
  assert.equal(r.monto, 20);
});

test("inscribir: la misma persona no queda dos veces en el mismo torneo (aunque cambie tildes y mayúsculas)", async () => {
  await falla(() => inscribir({ nombres: "LUCIA", apellidos: " quispe  mamani " }), "ya_inscrito");
});

test("inscribir: en otro torneo reutiliza al mismo jugador (así se mide quién vuelve)", async () => {
  const [t] = await como(DUENO, "insert into torneos (nombre, costo, anio) values ('Relámpago', 'S/ 10', 2026) returning id");
  const otra = await inscribir({ torneo_id: t.id, nombres: "Lucia", tutor_telefono: "900000002", tutor_nombre: "Papá" });
  const filas = await db.query("select jugador_id, monto::float as monto from inscripciones where id in ($1, $2) order by monto", [primera.id, otra.id]);
  assert.equal(filas.rows[0].jugador_id, filas.rows[1].jugador_id);
  assert.equal(filas.rows[0].monto, 10);
  assert.equal((await db.query("select count(*)::int as n from jugadores")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from tutores")).rows[0].n, 2, "otro celular = otro tutor");
});

test("inscribir: otra persona con el mismo nombre pero otra fecha es otro jugador", async () => {
  await inscribir({ fecha_nacimiento: "2015-06-10" });
  assert.equal((await db.query("select count(*)::int as n from jugadores")).rows[0].n, 2);
});

test("privacidad: el público no lee jugadores, tutores, inscripciones ni visitas", async () => {
  for (const tabla of ["jugadores", "tutores", "inscripciones", "perfiles", "visitas_diarias"])
    assert.deepEqual(await como(null, `select * from ${tabla}`), [], tabla);
});

test("privacidad: el entrenador no ve contactos ni visitas; el admin sí", async () => {
  assert.deepEqual(await como(ENTRENADOR, "select * from tutores"), []);
  assert.deepEqual(await como(ENTRENADOR, "select * from inscripciones"), []);
  assert.equal((await como(DUENO, "select * from tutores")).length, 3);
});

test("visitas: el público suma por día, página y evento", async () => {
  for (let k = 0; k < 3; k++) await como(null, "select registrar_evento('vista', '/academia/')");
  await como(null, "select registrar_evento('whatsapp', '/academia/')");
  const filas = await como(DUENO, "select pagina, evento, total from visitas_diarias order by evento");
  assert.deepEqual(filas, [
    { pagina: "/academia/", evento: "vista", total: 3 },
    { pagina: "/academia/", evento: "whatsapp", total: 1 },
  ]);
  assert.deepEqual(await como(ENTRENADOR, "select * from visitas_diarias"), []);
});

test("visitas: ignora eventos y páginas raros, y no deja inventar más de 40 páginas al día", async () => {
  await como(null, "select registrar_evento('borrar_todo', '/')");
  await como(null, "select registrar_evento('vista', 'https://otro.sitio/')");
  await como(null, "select registrar_evento('vista', '/<script>/')");
  for (let k = 0; k < 60; k++) await como(null, "select registrar_evento('vista', $1)", [`/p${k}/`]);
  const [{ n }] = (await db.query("select count(distinct pagina)::int as n from visitas_diarias")).rows;
  assert.equal(n, 40);
  const [{ e }] = (await db.query("select count(*)::int as e from visitas_diarias where evento not in ('vista', 'whatsapp')")).rows;
  assert.equal(e, 0);
});

test("visitas: el público no puede escribir directo en la tabla", async () => {
  await falla(() => como(null, "insert into visitas_diarias (dia, pagina, evento, total) values (current_date, '/', 'vista', 999)"), "row-level security");
});

// ---------------------------------------------------------------- cupo y lista de espera (migración 20261011)
test("cupo: al llenarse, los siguientes quedan en lista de espera (sin contar rechazados)", async () => {
  const [t] = await como(DUENO, "insert into torneos (nombre, cupo, anio) values ('Con cupo', '2 jugadores', 2026) returning id");
  const ficha2 = (n, f) => ({ torneo_id: t.id, nombres: n, apellidos: "Cupo", fecha_nacimiento: f });
  const a = await inscribir(ficha2("Ana", "2012-01-10"));
  const b = await inscribir(ficha2("Beto", "2012-02-10"));
  const c = await inscribir(ficha2("Caro", "2012-03-10"));
  assert.deepEqual([a.en_espera, b.en_espera, c.en_espera], [false, false, true]);
  // Si se rechaza a uno, se libera su lugar para el siguiente que se inscriba
  await como(DUENO, "update inscripciones set estado_pago = 'rechazado' where id = $1", [b.id]);
  const d = await inscribir(ficha2("Dani", "2012-04-10"));
  assert.equal(d.en_espera, false);
  const publicos = await como(null, "select nombre, en_espera from inscritos_publicos where torneo_id = $1 order by creado_en", [t.id]);
  assert.deepEqual(publicos.map((x) => [x.nombre, x.en_espera]), [["Ana Cupo", false], ["Caro Cupo", true], ["Dani Cupo", false]]);
  const [estado] = await como(null, "select * from estado_inscripciones($1)", [JSON.stringify([{ id: c.id, token: c.token }])]);
  assert.equal(estado.en_espera, true);
});

test("cupo: el torneo de verano toma su cupo de «Datos del club»; sin número no hay límite", async () => {
  assert.equal((await db.query("select cupo_de('Cupo: 32') as c")).rows[0].c, 32);
  assert.equal((await db.query("select cupo_de('sin límite') as c")).rows[0].c, null);
  await db.query("insert into contenido (campo, valor) values ('verano_cupo', '1')");
  const x = await inscribir({ nombres: "Tercera", fecha_nacimiento: "2014-01-01" });
  assert.equal(x.en_espera, true, "verano ya tiene inscritos y el cupo es 1");
});

// ---------------------------------------------------------------- academia
test("academia: solo el admin registra alumnos y pagos; ni el público ni el entrenador los ven", async () => {
  const [al] = await como(DUENO, "insert into alumnos (nombres, apellidos, nivel, tutor_telefono, mensualidad) values ('Luz', 'Prueba', 'Básico', '900000010', 80) returning id");
  await como(DUENO, "insert into pagos_mensuales (alumno_id, mes, monto, medio) values ($1, '2026-10-01', 80, 'Yape')", [al.id]);
  await falla(() => como(DUENO, "insert into pagos_mensuales (alumno_id, mes, monto) values ($1, '2026-10-01', 80)", [al.id]), "duplicate key");
  await falla(() => como(DUENO, "insert into pagos_mensuales (alumno_id, mes) values ($1, '2026-11-15')", [al.id]), "check");
  await falla(() => como(DUENO, "insert into alumnos (nombres, apellidos, tutor_telefono) values ('X', 'Y', '12345')"), "check");
  for (const quien of [null, ENTRENADOR]) {
    assert.deepEqual(await como(quien, "select * from alumnos"), []);
    assert.deepEqual(await como(quien, "select * from pagos_mensuales"), []);
  }
  await falla(() => como(ENTRENADOR, "insert into alumnos (nombres, apellidos) values ('X', 'Y')"), "row-level security");
  // Borrar al alumno borra sus pagos (derecho de supresión)
  await como(DUENO, "delete from alumnos where id = $1", [al.id]);
  assert.equal((await db.query("select count(*)::int as n from pagos_mensuales")).rows[0].n, 0);
});

// Prueba de integración de la base de datos de la web oficial (Supabase local o un proyecto de prueba).
// No corre con «npm test»: necesita una base de datos. Uso:
//   npx supabase start            (Docker)
//   npm run prueba:nube           (lee URL y claves de «npx supabase status»)
// Comprueba lo que la guía exige (sección 9.2): el público solo ve nombre, categoría y club; los datos
// de contacto y los comprobantes solo los ve el admin; nadie se registra solo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL_BD = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BD || !ANON || !SERVICIO) {
  console.error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const servicio = createClient(URL_BD, SERVICIO, opciones); // solo para preparar cuentas de prueba
const publico = () => createClient(URL_BD, ANON, opciones);

const sello = Date.now();
const datos = (extra = {}) => ({
  torneo_id: "verano-2027",
  nombres: "Lucía",
  apellidos: `Prueba ${sello}`,
  fecha_nacimiento: "2013-04-02",
  nivel: "Intermedio",
  club: "Ajedrez Club Mokewa",
  tutor_nombre: "María Prueba",
  tutor_telefono: "900000000",
  tutor_correo: "maria@ejemplo.pe",
  consentimiento: true,
  ...extra,
});
const png = () => new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: "image/png" });

async function cuenta(rol) {
  const correo = `${rol}.${sello}@prueba.mokewa.pe`;
  const clave = `Clave-${sello}-${rol}`;
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  assert.ifError(error);
  assert.ifError((await servicio.from("perfiles").insert({ id: data.user.id, nombre: `Prueba ${rol}`, rol })).error);
  const c = publico();
  assert.ifError((await c.auth.signInWithPassword({ email: correo, password: clave })).error);
  return { c, id: data.user.id };
}

let ins; // inscripción creada por el público
const anon = publico();

test("inscribir: calcula la categoría en el servidor y devuelve id y token", async () => {
  const { data, error } = await anon.rpc("inscribir", { p: datos({ categoria: "Libre" }) });
  assert.ifError(error);
  assert.equal(data.categoria, "Sub-14"); // 13 años al 1 de enero de 2027; ignora la categoría que manda el navegador
  assert.match(data.id, /^[0-9a-f-]{36}$/);
  assert.match(data.token, /^[0-9a-f-]{36}$/);
  ins = data;
});

test("inscribir: rechaza datos inválidos con mensajes conocidos", async () => {
  const casos = [
    [{ consentimiento: false }, "falta_consentimiento"],
    [{ torneo_id: "no-existe" }, "torneo_no_disponible"],
    [{ tutor_telefono: "12345" }, "telefono_invalido"],
    [{ tutor_correo: "sin-arroba" }, "correo_invalido"],
    [{ fecha_nacimiento: "1900-01-01" }, "sin_categoria"],
    [{ nombres: "" }, "datos_incompletos"],
  ];
  for (const [extra, codigo] of casos) {
    const { error } = await anon.rpc("inscribir", { p: datos(extra) });
    assert.ok(error?.message.includes(codigo), `${JSON.stringify(extra)} → ${error?.message}`);
  }
});

test("el público no lee datos privados (RLS)", async () => {
  for (const tabla of ["inscripciones", "jugadores", "tutores", "perfiles"]) {
    const { data } = await anon.from(tabla).select("*");
    assert.deepEqual(data ?? [], [], `el público leyó ${tabla}`);
  }
});

test("la lista pública muestra solo nombre, categoría y club", async () => {
  const { data, error } = await anon.from("inscritos_publicos").select("*").eq("torneo_id", "verano-2027");
  assert.ifError(error);
  const fila = data.find((f) => f.nombre === `Lucía Prueba ${sello}`);
  assert.ok(fila, "no aparece en la lista pública");
  assert.deepEqual(Object.keys(fila).sort(), ["categoria", "club", "creado_en", "nombre", "torneo_id", "validado"]);
});

test("el público no puede escribir en la lista pública ni en las tablas", async () => {
  const intentos = [
    anon.from("inscritos_publicos").update({ club: "hackeado" }).eq("torneo_id", "verano-2027").select(),
    anon.from("contenido").upsert({ campo: "whatsapp", valor: "51999999999" }).select(),
    anon.from("noticias").insert({ titulo: "x", cuerpo: "x" }).select(),
    anon.from("torneos").insert({ nombre: "x" }).select(),
    anon.from("inscripciones").update({ estado_pago: "validado" }).eq("id", ins.id).select(),
  ];
  for (const r of await Promise.all(intentos)) assert.ok(r.error || (r.data ?? []).length === 0, JSON.stringify(r.data));
});

test("comprobante: solo uno, en su ruta, con tipo y tamaño permitidos", async () => {
  const bucket = anon.storage.from("vouchers");
  assert.ok((await bucket.upload(`inscripciones/otra-ruta-${sello}`, png(), { contentType: "image/png" })).error, "subió a una ruta ajena");
  assert.ok((await bucket.upload(`inscripciones/${ins.id}`, new Blob(["hola"], { type: "text/plain" }), { contentType: "text/plain" })).error, "aceptó texto");
  const grande = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" });
  assert.ok((await bucket.upload(`inscripciones/${ins.id}`, grande, { contentType: "image/png" })).error, "aceptó más de 5 MB");
  assert.ifError((await bucket.upload(`inscripciones/${ins.id}`, png(), { contentType: "image/png" })).error);
  assert.ok((await bucket.upload(`inscripciones/${ins.id}`, png(), { contentType: "image/png", upsert: true })).error, "permitió reemplazarlo");
  assert.ok((await bucket.download(`inscripciones/${ins.id}`)).error, "el público descargó un comprobante");
});

test("registrar el comprobante exige el token", async () => {
  const otro = "00000000-0000-0000-0000-000000000000";
  assert.equal((await anon.rpc("registrar_voucher", { p_id: ins.id, p_token: otro })).data, false);
  assert.equal((await anon.rpc("registrar_voucher", { p_id: ins.id, p_token: ins.token })).data, true);
});

test("el estado del pago solo se consulta con el token", async () => {
  const mal = await anon.rpc("estado_inscripciones", { p: [{ id: ins.id, token: "00000000-0000-0000-0000-000000000000" }] });
  assert.deepEqual(mal.data, []);
  const bien = await anon.rpc("estado_inscripciones", { p: [{ id: ins.id, token: ins.token }] });
  assert.equal(bien.data[0].estado_pago, "pendiente");
});

test("nadie se registra solo", async () => {
  const { error } = await publico().auth.signUp({ email: `intruso.${sello}@prueba.mokewa.pe`, password: "Clave-larga-123" });
  assert.ok(error, "el registro público está abierto");
});

test("entrenador: publica noticias pero no ve inscripciones ni tutores", async () => {
  const { c } = await cuenta("entrenador");
  const n = await c.from("noticias").insert({ titulo: `Prueba ${sello}`, cuerpo: "Texto" }).select().single();
  assert.ifError(n.error);
  assert.deepEqual((await c.from("tutores").select("*")).data ?? [], []);
  assert.deepEqual((await c.from("inscripciones").select("*")).data ?? [], []);
  assert.ifError((await c.from("noticias").delete().eq("id", n.data.id)).error);
});

test("admin: ve contactos y comprobante, valida, y borra todo (derecho de supresión)", async () => {
  const { c } = await cuenta("admin");
  const { data, error } = await c
    .from("inscripciones")
    .select("id, estado_pago, jugador_id, jugador:jugadores(nombres, tutores(telefono, correo))")
    .eq("id", ins.id)
    .single();
  assert.ifError(error);
  assert.equal(data.jugador.tutores[0].correo, "maria@ejemplo.pe");
  const v = await c.storage.from("vouchers").download(`inscripciones/${ins.id}`);
  assert.ifError(v.error);
  assert.ifError((await c.from("inscripciones").update({ estado_pago: "validado" }).eq("id", ins.id)).error);
  const estado = await anon.rpc("estado_inscripciones", { p: [{ id: ins.id, token: ins.token }] });
  assert.equal(estado.data[0].estado_pago, "validado");
  assert.ifError((await c.storage.from("vouchers").remove([`inscripciones/${ins.id}`])).error);
  assert.ifError((await c.from("jugadores").delete().eq("id", data.jugador_id)).error);
  assert.equal((await c.from("tutores").select("id").eq("jugador_id", data.jugador_id)).data.length, 0);
  assert.equal((await c.from("inscripciones").select("id").eq("id", ins.id)).data.length, 0);
});

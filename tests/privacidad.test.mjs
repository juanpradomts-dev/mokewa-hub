// Pruebas de privacidad y reglas del club: DNI enmascarado, alias, nicks sensibles, ocultos
// y botones de contacto honestos. `npm test` (sin red).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calcular } from "../scripts/estadisticas.mjs";
import { enmascarar, tieneDigitosSensibles, RESERVADO } from "../src/lib/jugadores.js";
import { enlaceContacto, numeroWhatsapp, FACEBOOK } from "../src/lib/contacto.js";

const leer = async (f) => readFile(new URL(f, import.meta.url), "utf8");
const leerNdjson = async (f) => (await leer(f)).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const datos = {
  arenas: await leerNdjson("../data/lichess/arenas.ndjson"),
  suizos: await leerNdjson("../data/lichess/swiss.ndjson"),
  resultados: JSON.parse(await leer("../data/lichess/resultados.json")),
};
const alias = JSON.parse(await leer("../src/data/alias.json")).alias;
const privacidad = JSON.parse(await leer("../src/data/privacidad.json"));
const configReal = { alias, ocultos: privacidad.ocultos, sensibles: privacidad.nicks_sensibles };
const AHORA = new Date("2026-09-29T12:00:00Z");

// Recorre cualquier objeto y junta los valores que son nombres de jugador.
function nombresVisibles(obj, acc = []) {
  if (Array.isArray(obj)) obj.forEach((x) => nombresVisibles(x, acc));
  else if (obj && typeof obj === "object")
    for (const [k, v] of Object.entries(obj)) {
      if ((k === "u" || k === "ganador") && typeof v === "string") acc.push(v);
      else nombresVisibles(v, acc);
    }
  return acc;
}

test("enmascarar: 7+ dígitos seguidos se tapan dejando el primero", () => {
  assert.equal(enmascarar("A62941402SAMIR"), "A6•••••SAMIR");
  assert.equal(enmascarar("LionelPonce71186819"), "LionelPonce7•••••");
  assert.equal(enmascarar("pepe20202020"), "pepe2•••••");
  assert.equal(enmascarar("Joseph12-04-28"), "Joseph12-04-28");
  assert.equal(enmascarar("abc123456"), "abc123456"); // 6 dígitos: no se toca
  assert.equal(tieneDigitosSensibles("A6•••••SAMIR"), false);
});

test("ningún usuario visible trae 7+ dígitos (cálculo y archivos generados)", async () => {
  const { club, jugadores } = calcular(datos, AHORA, configReal);
  const enCalculo = nombresVisibles([club, jugadores]).filter(tieneDigitosSensibles);
  assert.deepEqual(enCalculo, []);
  const generados = [JSON.parse(await leer("../src/data/club.json"))];
  assert.deepEqual(nombresVisibles(generados).filter(tieneDigitosSensibles), []);
});

test("alias sin confirmar no cambian nada", () => {
  const { club } = calcular(datos, AHORA, configReal);
  assert.ok(alias.every((a) => a.confirmado === false), "las sugerencias deben venir sin confirmar");
  assert.equal(club.totales.jugadores, 758);
  assert.equal(club.totales.campeones, 85);
  assert.equal(club.interno.alias_fusionados, 0);
});

test("alias confirmados se fusionan antes de rankear y los totales se recalculan", () => {
  const conAlias = {
    ...configReal,
    alias: [{ principal: "ELFALLASSTJS", secundarias: ["ELFALLASTJS", "ELFALLASS"], confirmado: true }],
  };
  const { club, jugadores } = calcular(datos, AHORA, conAlias);
  assert.equal(club.totales.jugadores, 758 - 2);
  assert.equal(club.totales.campeones, 85 - 2); // las tres cuentas tenían títulos
  assert.equal(club.campeones[0].u, "ELFALLASSTJS");
  assert.equal(club.campeones[0].titulos, 7 + 4 + 1);
  assert.equal(club.records.mas_titulos.u, "ELFALLASSTJS");
  assert.ok(!jugadores.jugadores.some((j) => ["ELFALLASTJS", "ELFALLASS"].includes(j.u)));
});

test("alias que jugaron el mismo torneo no duplican torneos", () => {
  const { jugadores } = calcular(datos, AHORA, {
    ...configReal,
    alias: [{ principal: "AlexMokewa", secundarias: ["AlexsMokewa"], confirmado: true }],
  });
  const alex = jugadores.jugadores.find((j) => j.u === "AlexMokewa");
  assert.equal(alex.t, 55 + 43 - 4);
  assert.equal(new Set(alex.h.map((h) => h[0])).size, alex.h.length);
});

test("nicks sensibles: fuera de destacados, dentro del Salón completo", () => {
  const { club } = calcular(datos, AHORA, configReal);
  const sensibles = privacidad.nicks_sensibles.map((u) => u.toLowerCase());
  assert.equal(club.destacados.length, 3);
  assert.ok(club.destacados.every((d) => !sensibles.includes(d.u.toLowerCase())));
  assert.ok(club.campeones.some((c) => c.u === "DinaBoluarte" && c.sensible));
  assert.equal(club.records.mas_titulos.sensible, true);
});

test("ocultos: no aparecen en listados pero siguen contando", () => {
  const { club, jugadores } = calcular(datos, AHORA, { ...configReal, ocultos: ["CarlosMokewa"] });
  assert.equal(club.totales.jugadores, 758);
  assert.ok(!jugadores.jugadores.some((j) => j.u === "CarlosMokewa"));
  assert.ok(!club.fieles.some((f) => f.u === "CarlosMokewa"));
  assert.equal(club.records.mas_torneos.u, RESERVADO);
  assert.equal(club.records.mas_torneos.sensible, true);
});

test("contacto: sin número dice «Escríbenos» y abre Facebook; con número, WhatsApp", () => {
  const sin = enlaceContacto(null, "Hola");
  assert.equal(sin.tipo, "facebook");
  assert.equal(sin.href, FACEBOOK);
  assert.equal(sin.texto, "Escríbenos");
  assert.doesNotMatch(sin.texto + sin.aria, /whatsapp/i);
  assert.equal(enlaceContacto("12345", "Hola").tipo, "facebook");
  const con = enlaceContacto("987 654 321", "Hola, ¿horarios?");
  assert.equal(con.tipo, "whatsapp");
  assert.equal(con.href, "https://wa.me/51987654321?text=Hola%2C%20%C2%BFhorarios%3F");
  assert.match(con.texto, /WhatsApp/);
  assert.equal(enlaceContacto("51987654321", "x", "Consultar horario").texto, "Consultar horario");
  assert.equal(enlaceContacto(null, "x", "Consultar horario").texto, "Consultar horario");
  assert.equal(numeroWhatsapp("+51 987-654-321"), "51987654321");
});

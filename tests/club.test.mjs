// Pruebas: `npm test` (sin red). Verifican que las cifras que se muestran en la web
// salen del cálculo automático y que las reglas de categoría no se rompen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calcular, ritmo } from "../scripts/estadisticas.mjs";
import { categoriaPara, edadAl1Enero, esMenor } from "../src/lib/categorias.js";

const leerNdjson = async (f) => (await readFile(new URL(f, import.meta.url), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const datos = {
  arenas: await leerNdjson("../data/lichess/arenas.ndjson"),
  suizos: await leerNdjson("../data/lichess/swiss.ndjson"),
  resultados: JSON.parse(await readFile(new URL("../data/lichess/resultados.json", import.meta.url), "utf8")),
  equipo: null,
  cuenta: null,
  meta: null,
};

test("las cifras de la guía (26-09-2026) salen del cálculo, no escritas a mano", () => {
  const { club } = calcular(datos, new Date("2026-09-26T12:00:00Z"));
  const t = club.totales;
  // Mientras no haya torneos nuevos, deben coincidir con la sección 10.1 de la guía.
  assert.ok(t.torneos >= 156);
  if (t.torneos === 156) {
    assert.equal(t.arenas, 27);
    assert.equal(t.suizos, 129);
    assert.equal(t.participaciones, 2832);
    assert.equal(t.jugadores, 758);
    assert.equal(t.campeones, 85);
    assert.equal(t.fieles, 64);
    assert.equal(club.records.mas_torneos.n, 66);
    assert.equal(club.interno.por_recuperar, 644);
    assert.equal(t.mediana_suizo, 13);
    assert.equal(t.max_suizo, 53);
  }
});

test("cada torneo terminado con resultados tiene campeón y la suma por año cuadra", () => {
  const { club } = calcular(datos);
  const conResultados = club.torneos.filter((x) => x.con_resultados > 0);
  assert.ok(conResultados.every((x) => x.ganador));
  assert.equal(club.temporadas.reduce((s, a) => s + a.torneos, 0), club.totales.torneos);
  assert.equal(club.campeones.reduce((s, c) => s + c.titulos, 0), conResultados.length);
});

test("el índice de jugadores es coherente con los totales", () => {
  const { club, jugadores } = calcular(datos);
  assert.equal(jugadores.jugadores.length, club.totales.jugadores);
  const carlos = jugadores.jugadores.find((j) => j.u === club.records.mas_torneos.u);
  assert.equal(carlos.t, club.records.mas_torneos.n);
});

test("ritmo de juego y su tipo", () => {
  assert.deepEqual(ritmo({ limit: 60, increment: 0 }), { texto: "1+0", tipo: "bala" });
  assert.deepEqual(ritmo({ limit: 300, increment: 3 }), { texto: "5+3", tipo: "blitz" });
  assert.deepEqual(ritmo({ limit: 600, increment: 5 }), { texto: "10+5", tipo: "rápidas" });
  assert.deepEqual(ritmo({ limit: 1800, increment: 30 }), { texto: "30+30", tipo: "clásico" });
  assert.equal(ritmo({ limit: 30, increment: 0 }).texto, "0,5+0");
});

test("categoría por edad al 1 de enero del año del torneo", () => {
  assert.equal(edadAl1Enero("2019-01-01", 2027), 8);
  assert.equal(edadAl1Enero("2019-01-02", 2027), 7);
  assert.equal(categoriaPara("2019-06-10", 2027), "Sub-8");
  assert.equal(categoriaPara("2019-01-01", 2027), "Sub-10");
  assert.equal(categoriaPara("2015-06-10", 2027), "Sub-12");
  assert.equal(categoriaPara("2009-12-31", 2027), "Sub-18");
  assert.equal(categoriaPara("1990-05-05", 2027), "Libre");
  assert.equal(categoriaPara("2026-01-01", 2027), null);
  assert.equal(categoriaPara("no-es-fecha", 2027), null);
  assert.equal(categoriaPara("1990-05-05", 2027, ["Sub-9", "Sub-13"]), null);
});

test("minoría de edad", () => {
  const hoy = new Date("2026-09-29T12:00:00");
  assert.equal(esMenor("2008-09-30", hoy), true);
  assert.equal(esMenor("2008-09-29", hoy), false);
});

// «Próximo torneo» del inicio (src/lib/proximo.js): nunca muestra uno pasado ni uno de ejemplo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoTorneo } from "../src/lib/proximo.js";

const HOY = new Date("2026-10-11T12:00:00");
const verano = { id: "verano-2027", nombre: "Torneo de Verano 2027", ejemplo: true };

test("elige el más cercano con fecha de hoy en adelante", () => {
  const t = proximoTorneo([
    verano,
    { id: "a", nombre: "Pasado", fecha: "2026-10-01" },
    { id: "b", nombre: "Lejano", fecha: "2026-12-20" },
    { id: "c", nombre: "Cercano", fecha: "2026-10-18" },
    { id: "d", nombre: "En línea", fecha: "2026-10-12", modalidad: "Online" },
    { id: "e", nombre: "Sin fecha", fecha: "" },
  ], { hoy: HOY });
  assert.equal(t.nombre, "Cercano");
  assert.equal(t.fechaIso, "2026-10-18");
});

test("sin torneos con fecha: el de verano solo si el club confirmó su fecha", () => {
  assert.equal(proximoTorneo([verano], { hoy: HOY }), null);
  const conTexto = proximoTorneo([verano], { veranoFecha: "Sábado 16 de enero de 2027", hoy: HOY });
  assert.equal(conTexto.fechaTexto, "Sábado 16 de enero de 2027");
  assert.equal(proximoTorneo([verano], { veranoFecha: "2026-02-01", hoy: HOY }), null, "fecha ya pasada");
});
